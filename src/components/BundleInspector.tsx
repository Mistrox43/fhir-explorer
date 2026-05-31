import { useState } from 'react';
import type { BundleReport, InspectedEntry } from '../fhir/bundle';
import type { Selection } from '../fhir/spec';
import { profileByName } from '../fhir/spec';
import type { Finding } from '../fhir/validate';
import { diagnose } from '../fhir/diagnose';
import { DiagnosisPanel } from './DiagnosisPanel';

interface Props {
  report: BundleReport;
  onOpen: (sel: Selection, at?: string) => void;
}

/** Renders an inspected SERIS message Bundle: event, structure, per-entry checks. */
export function BundleInspector({ report, onOpen }: Props) {
  const aggregate: Finding[] = [
    ...report.structural,
    ...report.entries.flatMap((e) => e.validation.findings),
    ...report.danglingRefs.map((d) => ({
      severity: 'warning' as const,
      code: 'unresolved-reference',
      path: d.from,
      message: `points to ${d.reference}, which is not an entry in this Bundle.`,
      provenance: 'seris' as const,
    })),
  ];

  return (
    <div className="inspector">
      <div className="checker__summary">
        <span className={`chip chip--${report.counts.error ? 'error' : 'pass'}`}>
          {report.counts.error ? `${report.counts.error} error(s)` : 'No errors'}
        </span>
        <span className="checker__matched">
          Message Bundle · {report.counts.entries} entr{report.counts.entries === 1 ? 'y' : 'ies'}
        </span>
        <span className="checker__tallies">{report.counts.warning} warning(s)</span>
      </div>

      <DiagnosisPanel diagnoses={diagnose(aggregate)} />

      {report.event && (
        <section className="inspector__event">
          <h4>Triggering event</h4>
          <p>
            <code>{report.event.code ?? '(none)'}</code> {report.event.display && <strong>{report.event.display}</strong>}
            {report.event.useCase && <span className="inspector__uc"> · {report.event.useCase}</span>}
          </p>
          {report.event.meaning && <p className="inspector__meaning">{report.event.meaning}</p>}
        </section>
      )}

      {report.structural.length > 0 && (
        <section className="checker__group">
          <h4 className="checker__grouptitle checker__grouptitle--error">Message structure</h4>
          <ul>
            {report.structural.map((f, i) => (
              <li key={i} className={`finding finding--${f.severity}`}>
                <code className="finding__path">{f.path}</code>
                <span className="finding__msg">{f.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.danglingRefs.length > 0 && (
        <section className="checker__group">
          <h4 className="checker__grouptitle checker__grouptitle--warning">Unresolved references</h4>
          <ul>
            {report.danglingRefs.map((d, i) => (
              <li key={i} className="finding finding--warning">
                <code className="finding__path">{d.from}</code>
                <span className="finding__msg">points to {d.reference}, which is not an entry in this Bundle.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="checker__group">
        <h4 className="checker__grouptitle checker__grouptitle--info">Entries</h4>
        <ul className="inspector__entries">
          {report.entries.map((e) => (
            <EntryRow key={e.index} entry={e} onOpen={onOpen} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function EntryRow({ entry, onOpen }: { entry: InspectedEntry; onOpen: (sel: Selection, at?: string) => void }) {
  const [open, setOpen] = useState(false);
  const errs = entry.validation.counts.error;
  const findings = entry.validation.findings.filter((f) => f.severity === 'error' || f.severity === 'warning');

  return (
    <li className="inspector__entry">
      <div className="inspector__entryhead">
        <button
          type="button"
          className="inspector__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="inspector__caret">{findings.length ? (open ? '▾' : '▸') : '·'}</span>
          <span className="inspector__idx">{entry.index}</span>
          <code className="inspector__rtype">{entry.resourceType ?? '?'}</code>
        </button>
        {entry.profileName && profileByName.has(entry.profileName) && (
          <button
            type="button"
            className="ref-chip"
            onClick={() => onOpen({ kind: 'profile', name: entry.profileName! })}
          >
            {entry.profileName} →
          </button>
        )}
        <span className={`chip chip--${errs ? 'error' : 'pass'}`}>{errs ? `${errs} error(s)` : 'ok'}</span>
      </div>
      {open && findings.length > 0 && (
        <ul className="inspector__findings">
          {findings.map((f, i) => (
            <li key={i} className={`finding finding--${f.severity}`}>
              <code className="finding__path">{f.path}</code>
              <span className="finding__msg">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
