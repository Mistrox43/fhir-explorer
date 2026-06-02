import { useState } from 'react';
import { ORIENTATION, stepById } from '../orientation';
import type { OrientationStep } from '../orientation/types';
import type { Selection } from '../fhir/spec';
import { OrientationStepCard } from './OrientationStepCard';

interface Props {
  onOpen: (sel: Selection) => void;
  onValidate: (json: unknown, title?: string) => void;
  onOpenBuild: () => void;
}

/** Walks a curated case scenario step by step, tracking the case state so far. */
export function ScenarioPlayer({ onOpen, onValidate, onOpenBuild }: Props) {
  const [sid, setSid] = useState(ORIENTATION.scenarios[0].id);
  const [i, setI] = useState(0);

  const scenario = ORIENTATION.scenarios.find((s) => s.id === sid) ?? ORIENTATION.scenarios[0];
  const steps = scenario.stepIds
    .map((id) => stepById.get(id))
    .filter((s): s is OrientationStep => Boolean(s));
  const idx = Math.min(i, steps.length - 1);
  const step = steps[idx];
  const stateSoFar = steps
    .slice(0, idx + 1)
    .reverse()
    .find((s) => s.caseState)?.caseState;

  return (
    <div className="scenario">
      <nav className="tabs" aria-label="Scenario">
        {ORIENTATION.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`tab${s.id === sid ? ' tab--active' : ''}`}
            onClick={() => {
              setSid(s.id);
              setI(0);
            }}
            aria-current={s.id === sid}
          >
            {s.title}
          </button>
        ))}
      </nav>

      <p className="scenario__summary">{scenario.summary}</p>

      <div className="scenario__controls">
        <button type="button" className="json-action" disabled={idx === 0} onClick={() => setI(idx - 1)}>
          ← Prev
        </button>
        <span className="scenario__progress">
          Step {idx + 1} of {steps.length}
        </span>
        <button
          type="button"
          className="json-action json-action--accent"
          disabled={idx >= steps.length - 1}
          onClick={() => setI(idx + 1)}
        >
          Next →
        </button>
        {stateSoFar && (
          <span className={`ostep__state ostep__state--${stateSoFar}`}>case is {stateSoFar}</span>
        )}
      </div>

      <ol className="scenario__rail" aria-label="Scenario steps">
        {steps.map((s, n) => (
          <li
            key={s.id}
            className={`scenario__dot${n === idx ? ' scenario__dot--active' : ''}${n < idx ? ' scenario__dot--done' : ''}`}
          >
            <button type="button" onClick={() => setI(n)}>
              {n + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>

      {step && (
        <OrientationStepCard
          step={step}
          index={idx + 1}
          onOpen={onOpen}
          onValidate={onValidate}
          onOpenBuild={onOpenBuild}
        />
      )}
    </div>
  );
}
