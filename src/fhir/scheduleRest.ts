// Assembles the COMPLETE, conformant set of resources for standing up an OR's
// capacity in SERIS. Unlike OR Case events — which travel together in a single
// message Bundle — OR Schedule changes are submitted as INDIVIDUAL FHIR REST
// creates: one POST per resource, per the SERIS client CapabilityStatement,
// which declares `create` on Location, Schedule and Slot (and nothing else for
// the schedule side). There is no MessageHeader, Task or businessStatus here;
// each resource below is its own request, and later resources reference earlier
// ones by business identifier — so the create order matters.

const SD = 'http://ontariohealth.ca/fhir/StructureDefinition';
const SNOMED = 'http://snomed.info/sct';
const FACILITY = 'https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-health-care-facility-id';
const profileUrl = (n: string) => `${SD}/ca-on-seris-profile-${n}`;

// Required envelope: profile claim + HTEST security label + facility-id tag.
const envMeta = (name: string) => ({
  profile: [profileUrl(name)],
  security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'HTEST' }],
  tag: [{ system: FACILITY, code: '4001' }],
});

// The business identifier the Schedule is created with — every Slot points back
// to it, exactly as SERIS references by identifier rather than by literal URL.
const SCHEDULE_ID = { system: 'http://hospital.example/schedules', value: 'SCH-OR3-2025-06-02' };
const SERVICE = { coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] };

export interface RestCreate {
  id: string;
  ucRef?: string;
  /** The REST verb of the interaction (SERIS declares only `create`). */
  method: 'POST';
  /** The resource-type endpoint the request is sent to. */
  endpoint: string;
  title: string;
  /** What this resource is and what it references — shown as the payload caption. */
  note: string;
  resource: Record<string, unknown>;
  annotations: { path: string; note: string }[];
}

/**
 * The ordered REST-create sequence to stand up an OR's capacity. Each entry is a
 * separate request; later resources resolve their references against the
 * business identifiers created by earlier ones.
 */
export const SCHEDULE_CREATES: RestCreate[] = [
  {
    id: 'loc',
    ucRef: 'OR Schedule · UC16',
    method: 'POST',
    endpoint: '/Location',
    title: 'Create the OR room',
    note: 'The physical operating room. Created first because the Schedule references it. Its facility id (meta.tag = 4001) is the business key later resources point at.',
    resource: {
      resourceType: 'Location',
      meta: envMeta('Location'),
      extension: [{ url: `${SD}/ca-on-seris-ext-or-unit`, valueString: 'Main OR Suite' }],
      identifier: [{ system: 'http://hospital.example/locations', value: 'OR-3' }],
      status: 'active',
      name: 'OR-3',
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'OR', display: 'Operating Room' }] }],
      partOf: { identifier: { system: FACILITY, value: '4000' } },
    },
    annotations: [
      { path: 'meta', note: 'meta.tag = facility id 4001 (the key the Schedule references) and meta.security = HTEST — both required by SERIS.' },
      { path: 'type', note: 'Location.type is fixed to the v3-RoleCode system; "OR" = Operating Room.' },
      { path: 'partOf', note: 'Parent site (facility 4000), referenced by identifier — SERIS references by identifier, not literal URLs.' },
    ],
  },
  {
    id: 'sch',
    ucRef: 'OR Schedule · UC1',
    method: 'POST',
    endpoint: '/Schedule',
    title: 'Create the schedule (a shift)',
    note: 'Declares when the room is available for surgery. Its actor points at the OR Location by facility id, so the Location must already exist.',
    resource: {
      resourceType: 'Schedule',
      meta: envMeta('Schedule'),
      extension: [
        { url: `${SD}/ca-on-seris-ext-shift-type`, valueString: 'Day' },
        {
          url: `${SD}/ca-on-seris-ext-hours-of-operation`,
          extension: [
            { url: 'startTime', valueTime: '07:30:00' },
            { url: 'stopTime', valueTime: '15:30:00' },
            { url: 'daysOfWeek', valueString: 'Mon-Fri' },
          ],
        },
      ],
      identifier: [SCHEDULE_ID],
      active: true,
      actor: [{ identifier: { system: FACILITY, value: '4001' } }],
      planningHorizon: { start: '2025-06-02T07:30:00-04:00', end: '2025-06-02T15:30:00-04:00' },
    },
    annotations: [
      { path: 'actor', note: '→ the OR Location by facility id (4001). This cross-request reference is why the Location is created first.' },
      { path: 'identifier', note: 'schedules|SCH-OR3-2025-06-02 — the key every Slot below points back to.' },
      { path: 'planningHorizon', note: 'The shift window; closing a schedule (UC7) shortens this with a follow-up update.' },
    ],
  },
  {
    id: 'slot-free',
    ucRef: 'OR Schedule · UC6',
    method: 'POST',
    endpoint: '/Slot',
    title: 'Create a bookable slot',
    note: 'A free sub-interval of the shift a case can be booked into. Its own request; it resolves its parent Schedule by identifier.',
    resource: {
      resourceType: 'Slot',
      meta: envMeta('Slot'),
      extension: [{ url: `${SD}/ca-on-seris-ext-slot-name`, valueString: 'AM Slot 1' }],
      identifier: [{ system: 'http://hospital.example/slots', value: 'SLOT-AM-1' }],
      serviceType: [SERVICE],
      schedule: { identifier: SCHEDULE_ID },
      status: 'free',
      start: '2025-06-02T11:30:00-04:00',
      end: '2025-06-02T13:00:00-04:00',
    },
    annotations: [
      { path: 'schedule.identifier', note: '→ the Schedule created in step 2, by its identifier (not a literal Schedule/123 URL).' },
      { path: 'status', note: 'free = the time is bookable.' },
      { path: 'extension', note: 'The SlotName extension labels the slot.' },
    ],
  },
  {
    id: 'slot-block',
    ucRef: 'OR Schedule · UC2',
    method: 'POST',
    endpoint: '/Slot',
    title: 'Create a slot carrying a surgical block',
    note: 'Reserves recurring OR time for a service and surgeon(s) via the SERIS Block extension. Structurally the same as any other Slot — only the status and extension differ.',
    resource: {
      resourceType: 'Slot',
      meta: envMeta('Slot'),
      extension: [
        {
          url: `${SD}/ca-on-seris-ext-block`,
          extension: [
            { url: 'blockService', valueCodeableConcept: SERVICE },
            { url: 'blockSurgeons', valueIdentifier: { system: 'http://example.org/cpso', value: '12345' } },
          ],
        },
      ],
      identifier: [{ system: 'http://hospital.example/slots', value: 'SLOT-1' }],
      serviceType: [SERVICE],
      schedule: { identifier: SCHEDULE_ID },
      status: 'busy-unavailable',
      start: '2025-06-02T07:30:00-04:00',
      end: '2025-06-02T11:30:00-04:00',
    },
    annotations: [
      { path: 'extension', note: 'The SERIS Block extension bundles blockService + blockSurgeons sub-extensions.' },
      { path: 'schedule.identifier', note: '→ the same Schedule, by identifier.' },
      { path: 'status', note: 'busy-unavailable = the time is reserved by the block.' },
    ],
  },
];
