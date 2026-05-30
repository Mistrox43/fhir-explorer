import { useEffect, useRef } from 'react';
import type { CodeSystemDef, ValueSetDef } from '../fhir/types';

/** Renders a ValueSet: its composition, source systems, and concepts. */
export function ValueSetView({ valueSet, anchor }: { valueSet: ValueSetDef; anchor?: string }) {
  return (
    <div className="terminology">
      {valueSet.includes.length === 0 && <p className="empty">No composition defined.</p>}
      {valueSet.includes.map((inc, i) => (
        <section key={i} className="terminology__include">
          {inc.system && (
            <p className="terminology__system">
              from system <code>{inc.systemName ?? inc.system}</code>
            </p>
          )}
          {inc.filters && inc.filters.length > 0 && (
            <ul className="terminology__filters">
              {inc.filters.map((f) => (
                <li key={f}>
                  <code>{f}</code>
                </li>
              ))}
            </ul>
          )}
          {inc.concepts.length > 0 && <ConceptTable concepts={inc.concepts} anchor={anchor} />}
          {inc.concepts.length === 0 && (!inc.filters || inc.filters.length === 0) && (
            <p className="terminology__note">All codes from the system above.</p>
          )}
        </section>
      ))}
    </div>
  );
}

/** Renders a CodeSystem's concept list. */
export function CodeSystemView({ codeSystem, anchor }: { codeSystem: CodeSystemDef; anchor?: string }) {
  return (
    <div className="terminology">
      <ConceptTable concepts={codeSystem.concepts} withDefinition anchor={anchor} />
    </div>
  );
}

function ConceptTable({
  concepts,
  withDefinition,
  anchor,
}: {
  concepts: { code: string; display?: string; definition?: string }[];
  withDefinition?: boolean;
  anchor?: string;
}) {
  return (
    <table className="concept-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Display</th>
          {withDefinition && <th>Definition</th>}
        </tr>
      </thead>
      <tbody>
        {concepts.map((c) => (
          <ConceptRow key={c.code} concept={c} withDefinition={withDefinition} highlight={c.code === anchor} />
        ))}
      </tbody>
    </table>
  );
}

function ConceptRow({
  concept: c,
  withDefinition,
  highlight,
}: {
  concept: { code: string; display?: string; definition?: string };
  withDefinition?: boolean;
  highlight?: boolean;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlight && ref.current) ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight]);
  return (
    <tr ref={ref} className={highlight ? 'concept-row--flash' : undefined}>
      <td>
        <code>{c.code}</code>
      </td>
      <td>{c.display}</td>
      {withDefinition && <td className="concept-table__def">{c.definition}</td>}
    </tr>
  );
}
