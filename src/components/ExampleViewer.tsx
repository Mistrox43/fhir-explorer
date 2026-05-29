import { useState } from 'react';
import type { AnnotatedExample, FhirResource } from '../fhir/types';

interface Props {
  resource: FhirResource;
}

/** Shows worked example payloads with toggleable teaching annotations. */
export function ExampleViewer({ resource }: Props) {
  if (resource.examples.length === 0) {
    return <p className="empty">No examples yet for {resource.name}.</p>;
  }
  return (
    <div className="example-viewer">
      {resource.examples.map((ex) => (
        <Example key={ex.title} example={ex} />
      ))}
    </div>
  );
}

function Example({ example }: { example: AnnotatedExample }) {
  const [active, setActive] = useState<string | null>(null);
  const json = JSON.stringify(example.json, null, 2);

  return (
    <article className="example">
      <h3>{example.title}</h3>
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
              <span>{a.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
