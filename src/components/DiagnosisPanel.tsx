import { useState } from 'react';
import type { Diagnosis } from '../fhir/diagnose';

/** Prioritized, specific "Diagnosis & next steps" built from the actual findings. */
export function DiagnosisPanel({ diagnoses }: { diagnoses: Diagnosis[] }) {
  if (diagnoses.length === 0) return null;
  return (
    <section className="diagnosis" aria-label="Diagnosis and next steps">
      <h4 className="diagnosis__title">Diagnosis &amp; next steps</h4>
      <ol className="diagnosis__list">
        {diagnoses.map((d) => (
          <DiagnosisItem key={d.code} d={d} />
        ))}
      </ol>
    </section>
  );
}

function DiagnosisItem({ d }: { d: Diagnosis }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`diagnosis__item diagnosis__item--${d.severity}`}>
      <div className="diagnosis__head">
        <span className={`chip chip--${d.severity === 'error' ? 'error' : 'warn'}`}>{d.count}</span>
        <strong>{d.title}</strong>
        {d.playbook && (
          <button type="button" className="finding__fix" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? '▾' : '▸'} why
          </button>
        )}
      </div>
      <p className="diagnosis__advice">{d.advice}</p>
      {open && d.playbook && (
        <p className="diagnosis__cause">
          <strong>Cause:</strong> {d.playbook.cause}
          {d.playbook.scope === 'transport' && ' (out of scope for this tool)'}
        </p>
      )}
    </li>
  );
}
