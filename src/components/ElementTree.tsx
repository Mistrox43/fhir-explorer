import { useState } from 'react';
import type { FhirElement, FhirResource } from '../fhir/types';

interface Props {
  resource: FhirResource;
  /** Click a referenced resource type to navigate to it. */
  onNavigate: (name: string) => void;
}

/** Renders a resource's elements as an expandable list with metadata. */
export function ElementTree({ resource, onNavigate }: Props) {
  return (
    <div className="element-tree">
      <ul>
        {resource.elements.map((el) => (
          <ElementRow key={el.path} element={el} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function cardinalityLabel(el: FhirElement): string {
  return `${el.min}..${el.max}`;
}

function ElementRow({
  element,
  onNavigate,
}: {
  element: FhirElement;
  onNavigate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Indent nested backbone paths (e.g. Encounter.participant.individual).
  const depth = element.path.split('.').length - 2;
  const leaf = element.path.split('.').slice(-1)[0];
  const required = element.min > 0;

  return (
    <li className="element-row" style={{ marginLeft: depth * 20 }}>
      <button
        type="button"
        className="element-row__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="element-row__caret">{open ? '▾' : '▸'}</span>
        <span className="element-row__name">{leaf}</span>
        <span className={`badge badge--card${required ? ' badge--required' : ''}`}>
          {cardinalityLabel(element)}
        </span>
        {element.type.map((t) => (
          <span key={t} className="badge badge--type">
            {t}
          </span>
        ))}
        {element.isModifier && <span className="badge badge--modifier">modifier</span>}
        {element.isSummary && <span className="badge badge--summary">Σ</span>}
      </button>
      <p className="element-row__short">{element.short}</p>

      {open && (
        <div className="element-row__detail">
          {element.definition && <p>{element.definition}</p>}
          <dl>
            <dt>Path</dt>
            <dd>
              <code>{element.path}</code>
            </dd>
            {element.binding && (
              <>
                <dt>Binding</dt>
                <dd>
                  <span className={`badge badge--binding badge--binding-${element.binding.strength}`}>
                    {element.binding.strength}
                  </span>{' '}
                  {element.binding.valueSet}
                </dd>
              </>
            )}
            {element.references && (
              <>
                <dt>References</dt>
                <dd className="element-row__refs">
                  {element.references.map((ref) => (
                    <button
                      key={ref}
                      type="button"
                      className="ref-chip"
                      onClick={() => onNavigate(ref)}
                    >
                      {ref} →
                    </button>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </li>
  );
}
