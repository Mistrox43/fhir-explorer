// Data model for the Hospital System Simulator: the running "facility state",
// the declarative form schema (fields per activity), and the output a built
// activity produces. Activities are hand-curated but their field coverage is
// enforced against the generated SPEC by src/sim/coverage.test.ts.

import type { FacilityState } from './state';

/** The kinds of entity the simulated facility accumulates. */
export type EntityKind =
  | 'site'
  | 'location'
  | 'schedule'
  | 'slot'
  | 'patient'
  | 'practitioner'
  | 'practitionerRole'
  | 'case';

/** The current lifecycle state of a simulated surgical case. */
export type CaseState = 'booked' | 'performed' | 'cancelled' | 'entered-in-error';

/** A thing the user has created in the simulator, referenceable by later activities. */
export interface SimEntity {
  kind: EntityKind;
  /** Business identifier value — the key used for references and the facility panel. */
  key: string;
  /** Identifier system this key belongs to (for identifier-based references). */
  system?: string;
  /** Human label shown in dropdowns and the facility panel. */
  label: string;
  /** The field values that produced this entity (field path → value). */
  values: Record<string, unknown>;
  /** Cross-references to other entities by key, e.g. { schedule: 'SCH-…', patient: 'MRN-…' }. */
  refs?: Partial<Record<EntityKind, string>>;
  /** The facility id (meta.tag) this entity lives under — SERIS references the OR by it. */
  facilityId?: string;
  /** For cases only: the current business state. */
  state?: CaseState;
}

/** How a field is captured in the form. */
export type FieldInput =
  | 'text'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'boolean'
  | 'select'
  | 'entityRef';

/** One input in an activity form. `path` doubles as the value key the builder reads. */
export interface FieldDef {
  path: string;
  label: string;
  help?: string;
  input: FieldInput;
  required?: boolean;
  /** For 'select': the bound value-set name whose concepts become the options. */
  valueSet?: string;
  /** For 'select' without a value set: a fixed option list (e.g. base Slot.status codes). */
  options?: { value: string; label: string }[];
  /** For coded selects: the shape to emit (default 'CodeableConcept'). */
  shape?: 'code' | 'Coding' | 'CodeableConcept';
  /** For 'entityRef': which facility entity kind to pick from. */
  entityType?: EntityKind;
  /** Pre-filled value (also used by the coverage test to build a default payload). */
  default?: unknown;
  placeholder?: string;
}

/** What a built activity produces. */
export interface ActivityOutput {
  /** 'message' = OR Case (a message Bundle); 'rest' = OR Schedule (a single create/update). */
  kind: 'message' | 'rest';
  /** For 'rest': the HTTP verb + endpoint, e.g. POST /Slot. */
  method?: string;
  endpoint?: string;
  /** The FHIR payload — a Bundle for 'message', a single resource for 'rest'. */
  payload: Record<string, unknown>;
  /** The entity to add/update in facility state once generated. */
  entity: SimEntity;
}

/** A single hospital activity (one SERIS use case): its form + how it builds FHIR. */
export interface ActivityDef {
  /** Matches the orientation step id, e.g. 'sched-room', 'case-book'. */
  id: string;
  ucRef: string;
  track: 'schedule' | 'case';
  /** Stage grouping label, mirroring the stages in src/orientation/data.ts. */
  stage: string;
  title: string;
  summary: string;
  /** Profiles the produced payload is checked against (drives the coverage test). */
  targetProfiles: string[];
  /** Extension names this activity exercises (drives the coverage test). */
  extensions?: string[];
  fields: FieldDef[];
  build: (values: Record<string, unknown>, facility: FacilityState) => ActivityOutput;
}
