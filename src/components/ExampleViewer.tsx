import { useState } from 'react';
import type { TemplateExample } from '../fhir/types';
import { JsonActions } from './JsonActions';

interface Props {
  example?: TemplateExample;
  /** When provided, shows a "Validate this" action that runs the payload through the checker. */
  onValidate?: (json: unknown, title?: string) => void;
}

/** Shows a (generated) example payload with toggleable teaching annotations. */
export function ExampleViewer({ example, onValidate }: Props) {
  const [active, setActive] = useState<string | null>(null);
  if (!example) return <p className="empty">No template available for this profile.</p>;
  const json = JSON.stringify(example.json, null, 2);
  const filename = `${(example.title || 'example').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;

  return (
    <article className="example">
      <div className="example__head">
        <p className="example__desc">{example.description}</p>
        <JsonActions
          json={example.json}
          filename={filename}
          extra={
            onValidate && (
              <button
                type="button"
                className="json-action json-action--accent"
                onClick={() => onValidate(example.json, example.title)}
              >
                Validate this
              </button>
            )
          }
        />
      </div>
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
              onFocus={() => setActive(a.path)}
              onBlur={() => setActive(null)}
              tabIndex={0}
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
