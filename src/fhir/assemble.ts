// Assembles a COMPLETE, conformant SERIS message Bundle for a case event — the
// full set of resources that actually travels in the message, wired together by
// urn:uuid so the Bundle Inspector resolves every reference. The envelope is
// locked correct (type=message, leading MessageHeader, Task with businessStatus)
// and each resource conforms to its SERIS profile. References that SERIS makes by
// business identifier (e.g. the OR Location) stay inline and are not embedded.

const SD = 'http://ontariohealth.ca/fhir/StructureDefinition';
const CS = 'http://ontariohealth.ca/fhir/CodeSystem';
const SNOMED = 'http://snomed.info/sct';
const FACILITY = 'https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-health-care-facility-id';
const profileUrl = (n: string) => `${SD}/ca-on-seris-profile-${n}`;

export interface MessageEvent {
  code: string;
  display: string;
  business: string;
  /** A value set worth picking a code from for this event (for the Code Picker). */
  codePickVs: string;
}

export const MESSAGE_EVENTS: MessageEvent[] = [
  { code: 'case-scheduled', display: 'Case scheduled', business: 'booked', codePickVs: 'SurgicalPriorityClassification' },
  { code: 'case-performed', display: 'Case performed', business: 'performed', codePickVs: 'AnaesthesiaType' },
  { code: 'case-cancelled', display: 'Case cancelled', business: 'cancelled', codePickVs: 'SurgeryCancellationReason' },
];

const uid = (n: number) => `urn:uuid:11111111-1111-1111-1111-${String(n).padStart(12, '0')}`;
const ID = {
  mh: uid(1), task: uid(2), patient: uid(3), practitioner: uid(4), role: uid(5),
  appointment: uid(6), encounter: uid(7), procedure: uid(8), medication: uid(9), observation: uid(10),
};
const ref = (u: string) => ({ reference: u });
const idref = (system: string, value: string) => ({ identifier: { system, value } });
const envMeta = (name: string) => ({
  profile: [profileUrl(name)],
  security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'HTEST' }],
  tag: [{ system: FACILITY, code: '4001' }],
});

type Entry = { fullUrl: string; resource: Record<string, unknown> };

function patient(): Entry {
  return {
    fullUrl: ID.patient,
    resource: {
      resourceType: 'Patient',
      meta: envMeta('Patient'),
      identifier: [
        {
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] },
          system: 'http://hospital.example/mrn',
          value: 'MRN-0001',
        },
      ],
      name: [{ family: 'Chalmers', given: ['Peter'] }],
      gender: 'male',
      birthDate: '1974-12-25',
    },
  };
}

function practitioner(): Entry {
  return {
    fullUrl: ID.practitioner,
    resource: {
      resourceType: 'Practitioner',
      meta: envMeta('Practitioner'),
      identifier: [{ system: 'http://example.org/cpso', value: '12345' }],
      name: [{ family: 'Careful', given: ['Adam'], prefix: ['Dr'] }],
    },
  };
}

function practitionerRole(): Entry {
  return {
    fullUrl: ID.role,
    resource: {
      resourceType: 'PractitionerRole',
      meta: envMeta('PractitionerRole'),
      practitioner: ref(ID.practitioner),
      specialty: [{ coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] }],
    },
  };
}

function appointment(business: string): Entry {
  return {
    fullUrl: ID.appointment,
    resource: {
      resourceType: 'Appointment',
      meta: envMeta('Appointment'),
      identifier: [{ system: 'http://hospital.example/appointments', value: 'CASE-0001' }],
      status: business === 'cancelled' ? 'cancelled' : 'booked',
      reasonReference: [ref(ID.procedure)],
      participant: [{ actor: idref('http://hospital.example/mrn', 'MRN-0001'), status: 'accepted' }],
    },
  };
}

function procedure(business: string): Entry {
  const resource: Record<string, unknown> = {
    resourceType: 'Procedure',
    meta: envMeta('Procedure'),
    extension: [{ url: `${SD}/ca-on-seris-ext-in-room`, valuePeriod: { start: '2025-06-02T08:05:00-04:00', end: '2025-06-02T09:40:00-04:00' } }],
    status: business === 'performed' ? 'completed' : 'preparation',
    category: [{ coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] }],
    code: { coding: [{ system: `${CS}/WTIS-procedure-code`, code: 'W.CRD.ABL', display: 'Cardiac - Ablation' }] },
    subject: ref(ID.patient),
    encounter: ref(ID.encounter),
    performer: [{ actor: ref(ID.role) }],
    location: idref(FACILITY, '4001'),
  };
  if (business === 'performed') resource.performedPeriod = { start: '2025-06-02T08:20:00-04:00', end: '2025-06-02T09:25:00-04:00' };
  return { fullUrl: ID.procedure, resource };
}

function encounter(business: string): Entry {
  const status = business === 'performed' ? 'finished' : business === 'cancelled' ? 'cancelled' : 'planned';
  const resource: Record<string, unknown> = {
    resourceType: 'Encounter',
    meta: envMeta('Encounter'),
    status,
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{ coding: [{ system: 'http://cihi.ca/fhir/CodeSystem/aac-admit-category', code: 'L', display: 'Elective' }] }],
    priority: { coding: [{ system: `${CS}/surgical-priority-classification`, code: 'P1D', display: 'Access within 2-7 days' }] },
    subject: ref(ID.patient),
    appointment: [ref(ID.appointment)],
    period: { start: '2025-06-02T07:30:00-04:00', ...(business === 'performed' ? { end: '2025-06-02T09:40:00-04:00' } : {}) },
    reasonReference: [ref(ID.procedure)],
  };
  if (business === 'cancelled') {
    resource.extension = [
      {
        url: `${SD}/ca-on-seris-ext-cancellation`,
        extension: [
          { url: 'CancellationReason', valueCodeableConcept: { coding: [{ system: `${CS}/surgery-cancellation-reason`, code: 'advw-104', display: 'Adverse Weather - Patient' }] } },
          { url: 'CancellationDate', valueDateTime: '2025-06-01T16:20:00-04:00' },
        ],
      },
    ];
  }
  return { fullUrl: ID.encounter, resource };
}

function medicationAdministration(): Entry {
  return {
    fullUrl: ID.medication,
    resource: {
      resourceType: 'MedicationAdministration',
      meta: envMeta('MedicationAdministration'),
      status: 'completed',
      medicationCodeableConcept: { coding: [{ system: SNOMED, code: '50697003', display: 'General anesthesia' }] },
      subject: ref(ID.patient),
      effectiveDateTime: '2025-06-02T08:10:00-04:00',
      partOf: [ref(ID.procedure)],
    },
  };
}

function observation(): Entry {
  return {
    fullUrl: ID.observation,
    resource: {
      resourceType: 'Observation',
      meta: envMeta('Observation'),
      status: 'final',
      code: { coding: [{ system: SNOMED, code: '302132005', display: 'American Society of Anesthesiologists physical status' }] },
      valueCodeableConcept: { coding: [{ system: `${CS}/asa-physical-status`, code: 'ASA II' }] },
      subject: ref(ID.patient),
      partOf: [ref(ID.procedure)],
    },
  };
}

function messageHeader(ev: MessageEvent): Entry {
  return {
    fullUrl: ID.mh,
    resource: {
      resourceType: 'MessageHeader',
      meta: { profile: [profileUrl('MessageHeader')] },
      eventCoding: { system: `${CS}/message-event-code`, code: ev.code, display: ev.display },
      source: { endpoint: 'https://his.hospital.example/fhir' },
      focus: [ref(ID.task)],
    },
  };
}

function task(ev: MessageEvent): Entry {
  return {
    fullUrl: ID.task,
    resource: {
      resourceType: 'Task',
      meta: { profile: [profileUrl('Task')] },
      status: 'completed',
      basedOn: [ref(ID.appointment), ref(ID.encounter)],
      businessStatus: { coding: [{ system: `${CS}/business-status`, code: ev.business }] },
    },
  };
}

/** A description of every resource a given message contains, for the UI. */
export function messageContents(code: string): string[] {
  const base = ['MessageHeader', 'Task', 'Patient', 'Practitioner', 'PractitionerRole', 'Appointment', 'Encounter', 'Procedure'];
  return code === 'case-performed' ? [...base, 'MedicationAdministration', 'Observation'] : base;
}

export function assembleMessage(code: string): Record<string, unknown> | null {
  const ev = MESSAGE_EVENTS.find((e) => e.code === code);
  if (!ev) return null;

  const entries: Entry[] = [
    messageHeader(ev),
    task(ev),
    patient(),
    practitioner(),
    practitionerRole(),
    appointment(ev.business),
    encounter(ev.business),
    procedure(ev.business),
  ];
  if (ev.business === 'performed') {
    entries.push(medicationAdministration(), observation());
  }

  return {
    resourceType: 'Bundle',
    meta: envMeta('Bundle'),
    identifier: { system: 'http://hospital.example/messages', value: `MSG-${ev.code}-0001` },
    type: 'message',
    timestamp: '2025-06-02T10:00:00-04:00',
    entry: entries,
  };
}
