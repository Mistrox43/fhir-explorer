import { useMemo, useState } from 'react';
import { assembleMessage, messageContents, MESSAGE_EVENTS } from '../fhir/assemble';
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

  const contents = messageContents(code);
  const example: TemplateExample = {
    title: `${ev.display} message`,
    description: `The COMPLETE message Bundle that actually gets sent — all ${contents.length} resources wired together by urn:uuid so every reference resolves: ${contents.join(
      ', ',
    )}. The envelope is locked correct (type = "message", leading MessageHeader, Task businessStatus) and every resource conforms to its SERIS profile. References SERIS makes by business identifier (e.g. the OR Location) stay inline and aren't embedded. Copy, download, or "Validate this" to inspect it.`,
    json: bundle,
    annotations: [
      { path: 'type', note: 'Fixed to "message" — a SERIS submission is always a message Bundle.' },
      { path: 'entry[0]', note: 'MessageHeader leads; eventCoding names the event; focus → the Task.' },
      { path: 'entry[1]', note: 'Task: businessStatus + basedOn → the Appointment and Encounter.' },
      { path: 'entry[2]', note: 'Patient — the case resources reference it by urn:uuid (Procedure.subject, Encounter.subject).' },
      { path: 'entry[7]', note: 'Procedure references the Patient, Encounter, PractitionerRole — all resolved inside this Bundle.' },
    ],
  };

  return (
    <div className="builder">
      <p className="builder__lead">
        Assemble the <strong>complete</strong> SERIS message for a case event — every resource that
        travels in the Bundle, wired together and conformant. Swap in your real values and identifiers.
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
