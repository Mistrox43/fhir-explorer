import { useState } from 'react';
import type { ProfileElement } from '../fhir/types';
import type { Selection } from '../fhir/spec';
import { profileNames, valueSetByName } from '../fhir/spec';

interface Props {
  elements: ProfileElement[];
  onNavigate: (sel: Selection) => void;
}

/** Renders a profile/extension differential as an indented, expandable list. */
export function ElementTree({ elements, onNavigate }: Props) {
  if (elements.length === 0) {
    return <p className="empty">This profile applies no element-level constraints.</p>;
  }
  return (
    <div className="element-tree">
      <ul>
        {elements.map((el) => (
          <ElementRow key={el.id} element={el} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function cardinality(el: ProfileElement): string | null {
  if (el.min == null && el.max == null) return null;
  return `${el.min ?? ''}..${el.max ?? ''}`;
}

function ElementRow({
  element,
  onNavigate,
}: {
  element: ProfileElement;
  onNavigate: (sel: Selection) => void;
}) {
  const [open, setOpen] = useState(false);
  const card = cardinality(element);
  const hasDetail =
    element.definition || element.fixed || element.binding || element.types.some((t) => t.targets);

  return (
    <li className="element-row" style={{ marginLeft: (element.depth - 1) * 18 }}>
      <button
        type="button"
        className="element-row__header"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
      >
        <span className="element-row__caret">{hasDetail ? (open ? '▾' : '▸') : '·'}</span>
        <span className={`element-row__name${element.sliceName ? ' element-row__name--slice' : ''}`}>
          {element.leaf}
        </span>
        {card && (
          <span className={`badge badge--card${element.min ? ' badge--required' : ''}`}>{card}</span>
        )}
        {element.mustSupport && (
          <span className="badge badge--ms" title="Must Support">
            S
          </span>
        )}
        {element.types.map((t, i) => (
          <span key={`${t.code}-${i}`} className="badge badge--type">
            {t.code}
          </span>
        ))}
        {element.fixed && <span className="badge badge--fixed">fixed</span>}
        {element.binding && (
          <span className={`badge badge--binding badge--binding-${element.binding.strength}`}>
            {element.binding.strength}
          </span>
        )}
      </button>
      {element.short && <p className="element-row__short">{element.short}</p>}

      {open && hasDetail && (
        <div className="element-row__detail">
          {element.definition && <p>{element.definition}</p>}
          <dl>
            <dt>Path</dt>
            <dd>
              <code>{element.id}</code>
            </dd>

            {element.types.some((t) => t.targets || t.extensionProfile) && (
              <>
                <dt>Targets</dt>
                <dd className="element-row__refs">
                  {element.types.flatMap((t) => [
                    ...(t.targets ?? []).map((ref) => (
                      <RefChip
                        key={`ref-${ref}`}
                        label={ref}
                        disabled={!profileNames.has(ref)}
                        onClick={() => onNavigate({ kind: 'profile', name: ref })}
                      />
                    )),
                    ...(t.extensionProfile
                      ? [
                          <RefChip
                            key={`ext-${t.extensionProfile}`}
                            label={`${t.extensionProfile} (ext)`}
                            onClick={() =>
                              onNavigate({ kind: 'extension', name: t.extensionProfile! })
                            }
                          />,
                        ]
                      : []),
                  ])}
                </dd>
              </>
            )}

            {element.binding && (
              <>
                <dt>Binding</dt>
                <dd>
                  <span
                    className={`badge badge--binding badge--binding-${element.binding.strength}`}
                  >
                    {element.binding.strength}
                  </span>{' '}
                  {element.binding.valueSetName &&
                  valueSetByName.has(element.binding.valueSetName) ? (
                    <RefChip
                      label={element.binding.valueSetName}
                      onClick={() =>
                        onNavigate({ kind: 'valueSet', name: element.binding!.valueSetName! })
                      }
                    />
                  ) : (
                    <code>{element.binding.valueSetName ?? element.binding.valueSetUrl}</code>
                  )}
                </dd>
              </>
            )}

            {element.fixed && (
              <>
                <dt>{element.fixed.kind === 'fixed' ? 'Fixed value' : 'Pattern'}</dt>
                <dd>
                  <code>{summarizeValue(element.fixed.value)}</code>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </li>
  );
}

function RefChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (disabled) return <span className="ref-chip ref-chip--disabled">{label}</span>;
  return (
    <button type="button" className="ref-chip" onClick={onClick}>
      {label} →
    </button>
  );
}

/** Compact one-line rendering of a fixed/pattern value. */
function summarizeValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.coding) && v.coding[0]) {
      const c = v.coding[0] as Record<string, unknown>;
      return `${c.system ?? ''}#${c.code ?? ''}`;
    }
    if ('system' in v || 'code' in v) return `${v.system ?? ''}#${v.code ?? ''}`;
    return JSON.stringify(value);
  }
  return String(value);
}
