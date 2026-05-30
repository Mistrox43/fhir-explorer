import { assembleMessage } from '../fhir/assemble';
import { JsonActions } from './JsonActions';

const CURL = `curl -X POST "{{baseUrl}}/Bundle" \\
  -H "Authorization: Bearer {{token}}" \\
  -H "Content-Type: application/fhir+json" \\
  --data-binary @message.json`;

const POSTMAN = `// Postman / Insomnia
POST {{baseUrl}}/Bundle
Authorization: Bearer {{token}}
Content-Type: application/fhir+json

(body = the message Bundle below)`;

/** Implementer narrative + copy-paste request skeletons, from the IG's REST contract. */
export function ConnectivityGuide() {
  const sample = assembleMessage('case-performed');

  return (
    <section className="connectivity">
      <h3>Connectivity — how to submit</h3>
      <ul className="connectivity__points">
        <li>
          SERIS receives data as <strong>FHIR message Bundles</strong> (<code>type = "message"</code>)
          led by a MessageHeader — build one in the <strong>Build</strong> mode.
        </li>
        <li>
          The client CapabilityStatement declares <strong>create only</strong> — you POST resources /
          bundles; you don&rsquo;t read or search the repository.
        </li>
        <li>Submit by POSTing the message Bundle to the repository endpoint over HTTPS.</li>
      </ul>

      <h4>Submit a message — curl</h4>
      <div className="example__head">
        <p className="example__desc">
          Replace <code>{'{{baseUrl}}'}</code> and <code>{'{{token}}'}</code> with your environment values.
        </p>
        <JsonActions json={CURL} filename="submit-seris.sh" />
      </div>
      <pre className="example__code">
        <code>{CURL}</code>
      </pre>

      <h4>Request (Postman / Insomnia)</h4>
      <pre className="example__code">
        <code>{POSTMAN}</code>
      </pre>

      <h4>Minimal valid message body</h4>
      <div className="example__head">
        <p className="example__desc">A conformant case-performed envelope (from the builder).</p>
        <JsonActions json={sample} filename="message.json" />
      </div>
      <pre className="example__code">
        <code>{JSON.stringify(sample, null, 2)}</code>
      </pre>

      <p className="connectivity__scope">
        ⚠ Endpoints, authentication, TLS/mTLS, and live testing are <strong>environment-specific</strong>{' '}
        and out of scope here. See{' '}
        <a
          href="https://ehealthontario.on.ca/en/standards/ontario-surgical-efficiency-reporting-information-system-hl7-fhir-implementation-guide"
          target="_blank"
          rel="noreferrer"
        >
          eHealth Ontario
        </a>{' '}
        for the connectivity specification.
      </p>
    </section>
  );
}
