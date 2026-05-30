import { useMemo, useState } from 'react';
import { assembleMessage, MESSAGE_EVENTS } from '../fhir/assemble';
import type { TemplateExample } from '../fhir/types';
import { ExampleViewer } from './ExampleViewer';
import { CodePicker } from './CodePicker';
import { JsonActions } from './JsonActions';

interface Props {
  onValidate: (json: unknown, title?: string) => void;
}

/** "Build" mode: assemble a conformant SERIS message Bundle per case event. */
export function MessageAssembler({ onValidate }: Props) {
  const [code, setCode] = useState(MESSAGE_EVENTS[1].code);
  const [picked, setPicked] = useState<unknown>(null);
  const ev = MESSAGE_EVENTS.find((e) => e.code === code)!;
  const bundle = useMemo(() => assembleMessage(code), [code]);

  const example: TemplateExample = {
    title: `${ev.display} message`,
    description:
      'A ready-to-send SERIS message Bundle. The envelope is locked correct — type = "message", a leading MessageHeader with the fixed event system, a Task carrying the business status, urn:uuid fullUrls, and the MessageHeader → Task focus wired. The case resource is seeded from the validated orientation example. Copy, download, or "Validate this" to open it in the Bundle Inspector.',
    json: bundle,
    annotations: [
      { path: 'type', note: 'Fixed to "message" — a SERIS submission is always a message Bundle.' },
      { path: 'meta.tag', note: 'The submitting facility id (required on the Bundle).' },
      { path: 'entry[0]', note: 'MessageHeader leads the Bundle; eventCoding names the event; focus → the Task.' },
      { path: 'entry[1]', note: 'Task carries businessStatus (booked / performed / cancelled).' },
      { path: 'entry[2]', note: 'The case resource, seeded from the orientation example for this event.' },
    ],
  };

  return (
    <div className="builder">
      <p className="builder__lead">
        Assemble a ready-to-send SERIS message for a case event. The scaffolding is locked conformant;
        swap in your real resources and identifiers.
      </p>

      <nav className="tabs" aria-label="Message event">
        {MESSAGE_EVENTS.map((e) => (
          <button
            key={e.code}
            type="button"
            className={`tab${code === e.code ? ' tab--active' : ''}`}
            onClick={() => setCode(e.code)}
            aria-current={code === e.code}
          >
            {e.display}
          </button>
        ))}
      </nav>

      <ExampleViewer example={example} onValidate={onValidate} />

      <section className="builder__picker">
        <h4>Pick a {ev.codePickVs} code</h4>
        <p className="builder__pickerlead">
          A correctly-shaped <code>CodeableConcept</code> fragment to drop into the case resource.
        </p>
        <CodePicker valueSet={ev.codePickVs} onPick={(frag) => setPicked(frag)} />
        {picked != null && (
          <div className="builder__picked">
            <div className="example__head">
              <p className="example__desc">Selected fragment</p>
              <JsonActions json={picked} filename={`${ev.codePickVs}-fragment.json`} />
            </div>
            <pre className="example__code">
              <code>{JSON.stringify(picked, null, 2)}</code>
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
