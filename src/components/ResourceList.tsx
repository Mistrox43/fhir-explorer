import { RESOURCES } from '../fhir/data';
import type { FhirResource } from '../fhir/types';

interface Props {
  selected: string;
  onSelect: (name: string) => void;
}

/** Left sidebar listing curated resources, grouped by spec category. */
export function ResourceList({ selected, onSelect }: Props) {
  const groups = RESOURCES.reduce<Record<string, FhirResource[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <nav className="resource-list" aria-label="FHIR resources">
      {Object.entries(groups).map(([category, resources]) => (
        <div key={category} className="resource-group">
          <h3 className="resource-group__title">{category}</h3>
          <ul>
            {resources.map((r) => (
              <li key={r.name}>
                <button
                  type="button"
                  className={`resource-item${r.name === selected ? ' resource-item--active' : ''}`}
                  onClick={() => onSelect(r.name)}
                  aria-current={r.name === selected}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
