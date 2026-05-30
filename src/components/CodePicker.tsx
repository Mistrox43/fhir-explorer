import { useMemo, useState } from 'react';
import { valueSetByName } from '../fhir/spec';

export type CodeShape = 'code' | 'Coding' | 'CodeableConcept';

interface Concept {
  code: string;
  display?: string;
  system?: string;
}

interface Props {
  /** Bound value set to pick from. */
  valueSet: string;
  shape?: CodeShape;
  /** Emits the correctly-shaped fragment + the chosen concept. */
  onPick: (fragment: unknown, concept: Concept) => void;
  placeholder?: string;
}

/** Type-ahead over a value set's enumerated concepts; emits a shaped fragment. */
export function CodePicker({ valueSet, shape = 'CodeableConcept', onPick, placeholder }: Props) {
  const [q, setQ] = useState('');
  const vs = valueSetByName.get(valueSet);

  const concepts = useMemo<Concept[]>(() => {
    if (!vs) return [];
    return vs.includes.flatMap((inc) =>
      inc.concepts.map((c) => ({ code: c.code, display: c.display, system: inc.system })),
    );
  }, [vs]);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = ql
      ? concepts.filter((c) => c.code.toLowerCase().includes(ql) || (c.display ?? '').toLowerCase().includes(ql))
      : concepts;
    return list.slice(0, 30);
  }, [q, concepts]);

  if (!vs) return <p className="empty">Unknown value set: {valueSet}</p>;
  if (concepts.length === 0)
    return <p className="empty">{valueSet} is not enumerated (external/filtered) — pick a code manually.</p>;

  function shapeFragment(c: Concept): unknown {
    if (shape === 'code') return c.code;
    const coding = { system: c.system, code: c.code, display: c.display };
    return shape === 'Coding' ? coding : { coding: [coding] };
  }

  return (
    <div className="codepicker">
      <input
        type="search"
        className="codepicker__input"
        placeholder={placeholder ?? `Search ${valueSet} (${concepts.length} codes)…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={`Pick a code from ${valueSet}`}
      />
      <ul className="codepicker__list">
        {results.map((c) => (
          <li key={c.code}>
            <button type="button" className="codepicker__item" onClick={() => onPick(shapeFragment(c), c)}>
              <code>{c.code}</code>
              <span>{c.display}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="codepicker__empty">No match.</li>}
      </ul>
    </div>
  );
}
