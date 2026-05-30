import { PLAYBOOKS } from '../fhir/playbooks';

/** Browsable troubleshooting reference for support staff. */
export function Playbooks() {
  return (
    <details className="playbooks">
      <summary>
        Troubleshooting playbooks <span className="resource-group__count">{PLAYBOOKS.length}</span>
      </summary>
      <div className="playbooks__body">
        {PLAYBOOKS.map((p) => (
          <div key={p.id} className={`playbook${p.scope === 'transport' ? ' playbook--transport' : ''}`}>
            <p className="playbook__symptom">{p.symptom}</p>
            <p>
              <strong>Cause:</strong> {p.cause}
            </p>
            <p>
              <strong>Fix:</strong> {p.fix}
            </p>
            {p.scope === 'transport' && <span className="finding__prov">out of scope for this tool</span>}
          </div>
        ))}
      </div>
    </details>
  );
}
