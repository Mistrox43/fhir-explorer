import { SCHEDULE_CREATES } from '../fhir/scheduleRest';
import type { TemplateExample } from '../fhir/types';
import { ExampleViewer } from './ExampleViewer';

interface Props {
  onValidate: (json: unknown, title?: string) => void;
}

/**
 * "Build" sub-mode for OR Schedule events: the full, conformant set of resources
 * to stand up an OR's capacity, shown as an ordered sequence of discrete REST
 * creates — NOT a message Bundle. This is the deliberate counterpart to the
 * message assembler, so the message-vs-REST distinction stays crisp.
 */
export function ScheduleAssembler({ onValidate }: Props) {
  return (
    <div className="builder">
      <p className="builder__lead">
        OR Schedule changes are <strong>not</strong> sent as a message Bundle. Per the SERIS client
        CapabilityStatement, each is an individual FHIR <strong>REST create</strong> — one{' '}
        <code>POST</code> per resource. Below is the full sequence to stand up an OR's capacity;
        later resources reference earlier ones by business identifier, so the order matters.
      </p>

      <ol className="rest-seq">
        {SCHEDULE_CREATES.map((c, i) => {
          const example: TemplateExample = {
            title: `${c.method} ${c.endpoint} — ${c.title}`,
            description: c.note,
            json: c.resource,
            annotations: c.annotations,
          };
          return (
            <li key={c.id} className="rest-step">
              <div className="rest-step__head">
                <span className="rest-step__num">{i + 1}</span>
                <code className="rest-step__verb">
                  {c.method} {c.endpoint}
                </code>
                <span className="rest-step__title">{c.title}</span>
                {c.ucRef && <span className="ostep__uc">{c.ucRef}</span>}
              </div>
              <ExampleViewer example={example} onValidate={onValidate} />
            </li>
          );
        })}
      </ol>

      <p className="builder__footnote">
        SERIS accepts these as <strong>separate</strong> create requests — it declares{' '}
        <code>create</code> on <code>Location</code>, <code>Schedule</code> and <code>Slot</code>,
        not a transaction Bundle. There is no <code>MessageHeader</code>, <code>Task</code>, or{' '}
        <code>businessStatus</code> here — those belong to OR Case <em>messages</em>. Subsequent
        schedule changes (release a block, adjust hours, close a schedule…) follow the same
        pattern: a single create or update of one of these resources.
      </p>
    </div>
  );
}
