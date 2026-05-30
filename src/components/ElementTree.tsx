import { useEffect, useRef, useState } from 'react';
import type { ProfileElement } from '../fhir/types';
import type { Selection } from '../fhir/spec';
import { profileNames, valueSetByName } from '../fhir/spec';
import { parseComment } from '../fhir/sanitize';

interface Props {
  elements: ProfileElement[];
  onNavigate: (sel: Selection, at?: string) => void;
  /** Element id to scroll to and highlight (from a deep link / search). */
  anchor?: string;
}

/** Renders a profile/extension differential as an indented, expandable list. */
export function ElementTree({ elements, onNavigate, anchor }: Props) {
  if (elements.length === 0) {
    return <p className="empty">This profile applies no element-level constraints.</p>;
  }
  return (
    <div className="element-tree">
      <ul>
        {elements.map((el) => (
          <ElementRow
            key={el.id}
            element={el}
            onNavigate={onNavigate}
            highlight={!!anchor && el.id === anchor}
          />
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
  highlight,
}: {
  element: ProfileElement;
  onNavigate: (sel: Selection, at?: string) => void;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const card = cardinality(element);
  const comment = parseComment(element.comment);

  useEffect(() => {
    if (!highlight || !ref.current) return;
    setOpen(true);
    setFlash(true);
    ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = window.setTimeout(() => setFlash(false), 1600);
    return () => window.clearTimeout(t);
  }, [highlight]);
  const hasDetail = Boolean(
    element.definition ||
      comment?.base ||
      element.fixed ||
      element.binding ||
      element.slicing ||
      element.types.some((t) => t.targets),
  );

  return (
    <li
      ref={ref}
      className={`element-row${flash ? ' element-row--flash' : ''}`}
      style={{ marginLeft: (element.depth - 1) * 18 }}
    >
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
        {element.isModifier && (
          <span className="badge badge--modifier" title="Modifier element">
            ?!
          </span>
        )}
        {element.slicing && (
          <span className="badge badge--slice-def" title="This element is sliced">
            sliced
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
      {comment?.seris && (
        <p className="element-row__seris">
          <span className="element-row__seris-tag">SERIS</span>
          {comment.seris}
        </p>
      )}

      {open && hasDetail && (
        <div className="element-row__detail">
          {element.definition && <p>{element.definition}</p>}
          {comment?.base && <p className="element-row__comment">{comment.base}</p>}
          <dl>
            {element.slicing && (
              <>
                <dt>Sliced by</dt>
                <dd>
                  {element.slicing.discriminator.map((d) => (
                    <code key={d}>{d}</code>
                  ))}
                  {element.slicing.rules && (
                    <span className="element-row__slice-rules"> ({element.slicing.rules})</span>
                  )}
                </dd>
              </>
            )}
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
