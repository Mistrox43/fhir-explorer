// The simulated facility's running state: the entities the user has created
// (rooms, schedules, slots, patients, cases, …) keyed by kind. Held in a reducer
// and persisted to localStorage so a session survives refresh. This is SYNTHETIC
// data only and stays entirely on the device — it is never written to the
// shareable URL hash (see src/fhir/route.ts privacy invariant).

import type { EntityKind, SimEntity } from './types';

export interface FacilityState {
  /** The site's facility id (goes in every resource's meta.tag). */
  facilityId: string;
  entities: Record<EntityKind, SimEntity[]>;
}

const emptyEntities = (): Record<EntityKind, SimEntity[]> => ({
  site: [],
  location: [],
  schedule: [],
  slot: [],
  patient: [],
  practitioner: [],
  practitionerRole: [],
  case: [],
});

export const emptyFacility = (): FacilityState => ({ facilityId: '4001', entities: emptyEntities() });

export const entitiesOf = (s: FacilityState, kind: EntityKind): SimEntity[] => s.entities[kind];
export const findEntity = (s: FacilityState, kind: EntityKind, key: string): SimEntity | undefined =>
  s.entities[kind].find((e) => e.key === key);

export type FacilityAction =
  | { type: 'commit'; entity: SimEntity }
  | { type: 'remove'; kind: EntityKind; key: string }
  | { type: 'reset' }
  | { type: 'replace'; state: FacilityState };

export function facilityReducer(state: FacilityState, action: FacilityAction): FacilityState {
  switch (action.type) {
    case 'commit': {
      const { entity } = action;
      const list = state.entities[entity.kind];
      const idx = list.findIndex((e) => e.key === entity.key);
      const next = idx >= 0 ? list.map((e, i) => (i === idx ? entity : e)) : [...list, entity];
      return { ...state, entities: { ...state.entities, [entity.kind]: next } };
    }
    case 'remove': {
      const list = state.entities[action.kind].filter((e) => e.key !== action.key);
      return { ...state, entities: { ...state.entities, [action.kind]: list } };
    }
    case 'reset':
      return emptyFacility();
    case 'replace':
      return action.state;
    default:
      return state;
  }
}

// ---- persistence (localStorage, versioned) --------------------------------

const STORAGE_KEY = 'seris-sim-facility-v1';

export function loadFacility(): FacilityState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FacilityState;
    if (parsed && parsed.entities && typeof parsed.facilityId === 'string') {
      // Backfill any entity kinds added since the state was saved.
      return { facilityId: parsed.facilityId, entities: { ...emptyEntities(), ...parsed.entities } };
    }
  } catch {
    /* ignore corrupt state */
  }
  return null;
}

export function saveFacility(state: FacilityState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — stay in-memory */
  }
}

export function clearStoredFacility(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---- a ready-made sample facility (so Case forms have things to reference) --

const entity = (
  kind: EntityKind,
  key: string,
  label: string,
  values: Record<string, unknown>,
  extra: Partial<SimEntity> = {},
): SimEntity => ({ kind, key, label, values, ...extra });

/** A seeded facility: a site, one OR room + schedule + slot, and a patient/surgeon. */
export function sampleFacility(): FacilityState {
  return {
    facilityId: '4001',
    entities: {
      ...emptyEntities(),
      site: [entity('site', '4000', 'General Hospital (site 4000)', { facilityId: '4000' })],
      location: [
        entity('location', 'OR-3', 'OR-3 — Operating Room', {
          facilityId: '4001',
          'identifier.value': 'OR-3',
          name: 'OR-3',
          status: 'active',
        }, { facilityId: '4001' }),
      ],
      schedule: [
        entity('schedule', 'SCH-OR3-2025-06-02', 'OR-3 · Day shift · 2025-06-02', {
          'identifier.value': 'SCH-OR3-2025-06-02',
        }, { facilityId: '4001', refs: { location: 'OR-3' } }),
      ],
      slot: [
        entity('slot', 'SLOT-AM-1', 'AM Slot 1 (free) · OR-3', {
          'identifier.value': 'SLOT-AM-1',
          status: 'free',
        }, { facilityId: '4001', refs: { schedule: 'SCH-OR3-2025-06-02' } }),
      ],
      patient: [
        entity('patient', 'MRN-0001', 'Peter Chalmers (MRN-0001)', {
          'identifier.value': 'MRN-0001',
          'name.family': 'Chalmers',
          'name.given': 'Peter',
        }),
      ],
      practitioner: [
        entity('practitioner', '12345', 'Dr Adam Careful (CPSO 12345)', {
          'identifier.value': '12345',
          'name.family': 'Careful',
          'name.given': 'Adam',
        }),
      ],
      practitionerRole: [
        entity('practitionerRole', 'ROLE-1', 'Adam Careful — Cardiac surgery', {
          'identifier.value': 'ROLE-1',
        }, { refs: { practitioner: '12345' } }),
      ],
      case: [
        entity('case', 'CASE-0001', 'Case CASE-0001', {
          caseId: 'CASE-0001',
          patient: 'MRN-0001',
          surgeon: '12345',
          location: 'OR-3',
        }, { state: 'booked', refs: { patient: 'MRN-0001', practitioner: '12345', location: 'OR-3' } }),
      ],
    },
  };
}
