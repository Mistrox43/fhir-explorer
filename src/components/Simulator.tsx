import { useState } from 'react';
import { activitiesByTrack } from '../sim/activities';
import { SimFacilityPanel } from './SimFacilityPanel';
import { SimActivityForm } from './SimActivityForm';

interface Props {
  onValidate: (json: unknown, title?: string) => void;
}

type Track = 'schedule' | 'case';

/** "Simulate" mode: drive hospital activities and generate the SERIS FHIR they transmit. */
export function Simulator({ onValidate }: Props) {
  const [track, setTrack] = useState<Track>('schedule');
  const [activeId, setActiveId] = useState<string | null>(null);

  const activities = activitiesByTrack(track);
  const active = activities.find((a) => a.id === activeId) ?? null;
  const stages = [...new Set(activities.map((a) => a.stage))];

  return (
    <div className="sim">
      <p className="builder__lead">
        Act as the hospital system: pick an activity, fill in the inputs (coded values are dropdowns), and
        generate the exact SERIS FHIR it transmits — a message Bundle for OR Case events, a REST create for
        OR Schedule changes. Entities you create persist and can be referenced by later activities.
      </p>

      <nav className="tabs build-subnav" aria-label="Simulator track">
        {(['schedule', 'case'] as Track[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`tab${track === t ? ' tab--active' : ''}`}
            onClick={() => {
              setTrack(t);
              setActiveId(null);
            }}
            aria-current={track === t}
          >
            {t === 'schedule' ? 'OR Schedule' : 'OR Case'}
          </button>
        ))}
      </nav>

      <div className="sim__body">
        <aside className="sim__side">
          <SimFacilityPanel />
          <div className="sim__activities">
            {stages.map((stage) => (
              <div key={stage} className="sim__stage">
                <h4 className="sim__stage-title">{stage}</h4>
                <ul>
                  {activities
                    .filter((a) => a.stage === stage)
                    .map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={`sim__actbtn${active?.id === a.id ? ' sim__actbtn--active' : ''}`}
                          onClick={() => setActiveId(a.id)}
                        >
                          <span>{a.title}</span>
                          <span className="sim__uc">{a.ucRef}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            {activities.length === 0 && <p className="empty">OR Case activities are coming next.</p>}
          </div>
        </aside>

        <main className="sim__main">
          {active ? (
            <SimActivityForm key={active.id} activity={active} onValidate={onValidate} />
          ) : (
            <p className="empty">Pick an activity on the left to begin.</p>
          )}
        </main>
      </div>
    </div>
  );
}
