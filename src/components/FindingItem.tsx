import { useState } from 'react';
import type { Finding } from '../fhir/validate';
import { matchPlaybook } from '../fhir/playbooks';

/** A conformance finding with an inline "how to fix" playbook when one matches. */
export function FindingItem({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const pb =
    finding.severity === 'error' || finding.severity === 'warning'
      ? matchPlaybook(finding)
      : undefined;

  return (
    <li className={`finding finding--${finding.severity}`}>
      <code className="finding__path">{finding.path}</code>
      <span className="finding__msg">{finding.message}</span>
      {finding.provenance === 'not-checked' && <span className="finding__prov">not checked</span>}
      {pb && (
        <button type="button" className="finding__fix" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '▾' : '▸'} how to fix
        </button>
      )}
      {pb && open && (
        <div className="finding__playbook">
          <p>
            <strong>Cause:</strong> {pb.cause}
          </p>
          <p>
            <strong>Fix:</strong> {pb.fix}
          </p>
          {pb.scope === 'transport' && <span className="finding__prov">out of scope for this tool</span>}
        </div>
      )}
    </li>
  );
}
