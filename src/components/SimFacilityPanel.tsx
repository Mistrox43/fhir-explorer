import { useSim } from '../sim/simContext';
import type { EntityKind } from '../sim/types';

const KIND_LABEL: Record<EntityKind, string> = {
  site: 'Sites',
  location: 'OR rooms',
  schedule: 'Schedules',
  slot: 'Slots',
  patient: 'Patients',
  practitioner: 'Practitioners',
  practitionerRole: 'Surgeon roles',
  case: 'Cases',
};

const ORDER: EntityKind[] = [
  'site',
  'location',
  'schedule',
  'slot',
  'patient',
  'practitioner',
  'practitionerRole',
  'case',
];

/** Left-hand panel showing the running facility state with reset/seed controls. */
export function SimFacilityPanel() {
  const { facility, reset, seed, remove } = useSim();
  const total = ORDER.reduce((n, k) => n + facility.entities[k].length, 0);

  return (
    <section className="sim__facility">
      <div className="sim__facility-head">
        <h3>Facility state</h3>
        <div className="sim__facility-actions">
          <button type="button" className="json-action" onClick={seed}>
            Seed sample
          </button>
          <button type="button" className="json-action" onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {total === 0 ? (
        <p className="empty">Nothing yet — create an OR room, or seed a sample facility.</p>
      ) : (
        ORDER.map((kind) => {
          const list = facility.entities[kind];
          if (list.length === 0) return null;
          return (
            <div key={kind} className="sim__facility-group">
              <span className="sim__facility-label">{KIND_LABEL[kind]}</span>
              <ul>
                {list.map((e) => (
                  <li key={e.key}>
                    <span className="sim__entity">
                      {e.label}
                      {e.state ? ` · ${e.state}` : ''}
                    </span>
                    <button
                      type="button"
                      className="sim__entity-x"
                      aria-label={`Remove ${e.label}`}
                      onClick={() => remove(kind, e.key)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      <p className="sim__privacy">Synthetic data only · stored on this device · never included in shared links.</p>
    </section>
  );
}
