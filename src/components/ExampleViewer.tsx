import { useState } from 'react';
import type { TemplateExample } from '../fhir/types';

/** Shows a (generated) example payload with toggleable teaching annotations. */
export function ExampleViewer({ example }: { example?: TemplateExample }) {
  const [active, setActive] = useState<string | null>(null);
  if (!example) return <p className="empty">No template available for this profile.</p>;
  const json = JSON.stringify(example.json, null, 2);

  return (
    <article className="example">
      <p className="example__desc">{example.description}</p>
      <div className="example__body">
        <pre className="example__code">
          <code>{json}</code>
        </pre>
        <ul className="example__notes" aria-label="Annotations">
          {example.annotations.map((a) => (
            <li
              key={a.path}
              className={`example__note${active === a.path ? ' example__note--active' : ''}`}
              onMouseEnter={() => setActive(a.path)}
              onMouseLeave={() => setActive(null)}
            >
              <code className="example__note-path">{a.path}</code>
              {a.note && <span>{a.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
