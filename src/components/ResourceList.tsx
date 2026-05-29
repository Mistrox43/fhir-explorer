import { useState } from 'react';
import { SPEC } from '../fhir/spec';
import type { ArtifactKind, Selection } from '../fhir/spec';

interface Props {
  selected: Selection;
  onSelect: (sel: Selection) => void;
}

interface Section {
  kind: ArtifactKind;
  title: string;
  items: string[];
}

/** Left sidebar grouping every IG artifact by kind, with a quick filter. */
export function ResourceList({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const sections: Section[] = [
    { kind: 'profile', title: 'Profiles', items: SPEC.profiles.map((p) => p.name) },
    { kind: 'extension', title: 'Extensions', items: SPEC.extensions.map((e) => e.name) },
    { kind: 'valueSet', title: 'Value Sets', items: SPEC.valueSets.map((v) => v.name) },
    { kind: 'codeSystem', title: 'Code Systems', items: SPEC.codeSystems.map((c) => c.name) },
    {
      kind: 'capability',
      title: 'Capabilities',
      items: SPEC.capabilityStatements.map((c) => c.name),
    },
  ];

  return (
    <nav className="resource-list" aria-label="IG artifacts">
      <input
        type="search"
        className="resource-filter"
        placeholder="Filter…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter artifacts"
      />
      {sections.map((section) => {
        const items = q ? section.items.filter((n) => n.toLowerCase().includes(q)) : section.items;
        if (items.length === 0) return null;
        return (
          <div key={section.kind} className="resource-group">
            <h3 className="resource-group__title">
              {section.title} <span className="resource-group__count">{items.length}</span>
            </h3>
            <ul>
              {items.map((name) => {
                const active = selected.kind === section.kind && selected.name === name;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      className={`resource-item${active ? ' resource-item--active' : ''}`}
                      onClick={() => onSelect({ kind: section.kind, name })}
                      aria-current={active}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
