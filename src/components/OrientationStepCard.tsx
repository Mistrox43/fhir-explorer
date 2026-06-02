import { useState } from 'react';
import type { OrientationStep } from '../orientation/types';
import type { Selection } from '../fhir/spec';
import { profileByName } from '../fhir/spec';
import { ArtifactChip } from './ArtifactChip';
import { ExampleViewer } from './ExampleViewer';

interface Props {
  step: OrientationStep;
  /** Optional ordinal shown as a step number. */
  index?: number;
  onOpen: (sel: Selection) => void;
  onValidate: (json: unknown, title?: string) => void;
  /** Switch to Build mode (optionally at a specific message event) to see the full message. */
  onOpenBuild?: (eventCode?: string) => void;
}

const GROUP_LABELS: Record<string, string> = {
  produces: 'Produces',
  extends: 'Uses extensions',
  codes: 'Key codes',
};
const GROUP_ORDER = ['produces', 'extends', 'codes'] as const;

/** A single business-event card: narrative, FHIR artifacts, example, template. */
export function OrientationStepCard({ step, index, onOpen, onValidate, onOpenBuild }: Props) {
  const [showFhir, setShowFhir] = useState(false);
  const template = step.primaryProfile ? profileByName.get(step.primaryProfile)?.template : undefined;

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: step.artifacts.filter((a) => (a.group ?? 'produces') === g),
  })).filter((x) => x.items.length > 0);

  return (
    <article className="ostep">
      <div className="ostep__head">
        {index != null && <span className="ostep__num">{index}</span>}
        <div className="ostep__titles">
          <div className="ostep__titlerow">
            <h3>{step.title}</h3>
            {step.caseState && <span className={`ostep__state ostep__state--${step.caseState}`}>{step.caseState}</span>}
            {step.ucRef && <span className="ostep__uc">{step.ucRef}</span>}
          </div>
          <p className="ostep__event">{step.event}</p>
          <p className="ostep__meta">
            <span title="Actor">👤 {step.actor}</span>
            {step.action && <span className="ostep__action">{step.action}</span>}
          </p>
        </div>
      </div>

      {step.transmits && (
        <div className="ostep__transmit">
          <span className="ostep__transmit-label">📤 Reports to SERIS</span>
          <span className="ostep__transmit-body">
            sent now, as its own <code>{step.transmits.eventCode}</code> message
            {' '}— a Bundle whose Task carries businessStatus{' '}
            <code>{step.transmits.businessStatus}</code>
          </span>
          {onOpenBuild && (
            <button
              type="button"
              className="ostep__buildlink"
              onClick={() => onOpenBuild(step.transmits!.eventCode)}
            >
              See this message in Build →
            </button>
          )}
        </div>
      )}

      <div className="ostep__artifacts">
        {grouped.map(({ group, items }) => (
          <div key={group} className="ostep__group">
            <span className="ostep__group-label">{GROUP_LABELS[group]}</span>
            <div className="ostep__chips">
              {items.map((a) => (
                <ArtifactChip key={`${a.kind}:${a.name}`} artifact={a} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {(step.example || template) && (
        <>
          <button
            type="button"
            className="ostep__toggle"
            onClick={() => setShowFhir((v) => !v)}
            aria-expanded={showFhir}
          >
            {showFhir ? '▾' : '▸'} See the FHIR output
          </button>
          {showFhir && (
            <p className="ostep__fhir-note">
              📦 This shows the <strong>main resource</strong> this event produces. The actual
              submission also carries the resources it references (Patient, Encounter, …) — references
              to things like the OR Location use a business identifier instead.
              {step.transmits && onOpenBuild && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="ostep__buildlink"
                    onClick={() => onOpenBuild(step.transmits!.eventCode)}
                  >
                    See the complete message in Build →
                  </button>
                </>
              )}
            </p>
          )}
          {showFhir && (
            <div className="ostep__fhir">
              {step.example && (
                <div className="ostep__fhir-block">
                  <h4>Example for this event</h4>
                  <ExampleViewer example={step.example} onValidate={onValidate} />
                </div>
              )}
              {template && (
                <div className="ostep__fhir-block">
                  <h4>{step.primaryProfile} profile template</h4>
                  <ExampleViewer example={template} onValidate={onValidate} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
