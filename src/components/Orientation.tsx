import { useState } from 'react';
import { ORIENTATION, keyJourneySteps, stepById } from '../orientation';
import type { OrientationTrack } from '../orientation/types';
import type { Selection } from '../fhir/spec';
import { OrientationStepCard } from './OrientationStepCard';
import { ScenarioPlayer } from './ScenarioPlayer';
import { LifecycleMap } from './LifecycleMap';

interface Props {
  onOpenArtifact: (sel: Selection) => void;
  onValidate: (json: unknown, title?: string) => void;
}

type SubView = 'journey' | 'schedule' | 'case' | 'scenario' | 'lifecycle';

const SUBVIEWS: { id: SubView; label: string }[] = [
  { id: 'journey', label: 'Key Journey' },
  { id: 'schedule', label: 'OR Schedule' },
  { id: 'case', label: 'OR Case' },
  { id: 'scenario', label: 'Scenario Player' },
  { id: 'lifecycle', label: 'Lifecycle' },
];

export function Orientation({ onOpenArtifact, onValidate }: Props) {
  const [view, setView] = useState<SubView>('journey');
  const { intro, sourceUrl, tracks } = ORIENTATION;

  return (
    <div className="orientation">
      <section className="orientation-intro">
        <h2>{intro.headline}</h2>
        <p className="orientation-intro__what">{intro.what}</p>
        <div className="orientation-intro__grid">
          <div>
            <h4>Who's involved</h4>
            <ul className="orientation-intro__actors">
              {intro.actors.map((a) => (
                <li key={a.name}>
                  <strong>{a.name}</strong> — {a.role}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>How the data flows</h4>
            <p>{intro.dataFlow}</p>
          </div>
        </div>
        <p className="orientation-intro__how">{intro.howToUse}</p>
        <p className="orientation-intro__source">
          Business narrative summarised from the{' '}
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            SERIS IG · Business Context · Use Cases ↗
          </a>
        </p>
      </section>

      <nav className="tabs orientation-subnav" aria-label="Orientation view">
        {SUBVIEWS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`tab${view === s.id ? ' tab--active' : ''}`}
            onClick={() => setView(s.id)}
            aria-current={view === s.id}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {view === 'journey' ? (
        <section className="orientation-steps">
          <p className="orientation-steps__lead">
            The end-to-end story — from opening an OR to reporting a completed case. Open the OR
            Schedule and OR Case tracks above for every use case in detail.
          </p>
          {keyJourneySteps.map((step, i) => (
            <OrientationStepCard
              key={step.id}
              step={step}
              index={i + 1}
              onOpen={onOpenArtifact}
              onValidate={onValidate}
            />
          ))}
        </section>
      ) : view === 'scenario' ? (
        <ScenarioPlayer onOpen={onOpenArtifact} onValidate={onValidate} />
      ) : view === 'lifecycle' ? (
        <LifecycleMap />
      ) : (
        <TrackView
          track={tracks.find((t) => t.id === view) as OrientationTrack}
          onOpen={onOpenArtifact}
          onValidate={onValidate}
        />
      )}
    </div>
  );
}

function TrackView({
  track,
  onOpen,
  onValidate,
}: {
  track: OrientationTrack;
  onOpen: (sel: Selection) => void;
  onValidate: (json: unknown, title?: string) => void;
}) {
  return (
    <section className="orientation-steps">
      <p className="orientation-steps__lead">{track.summary}</p>
      {track.stages.map((stage) => (
        <div key={stage.title} className="orientation-stage">
          <h3 className="orientation-stage__title">{stage.title}</h3>
          {stage.stepIds
            .map((id) => stepById.get(id))
            .filter((s) => s)
            .map((step) => (
              <OrientationStepCard key={step!.id} step={step!} onOpen={onOpen} onValidate={onValidate} />
            ))}
        </div>
      ))}
    </section>
  );
}
