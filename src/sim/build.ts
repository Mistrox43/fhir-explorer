// Assembles the COMPLETE, wired OR Case message Bundle from the simulator's
// inputs + facility state. This generalizes src/fhir/assemble.ts (which builds a
// fixed sample): same envelope and the same urn:uuid wiring, parametrized by the
// patient/surgeon/case the user picked and the codes they chose. Conformance is
// dogfooded by src/sim/coverage.test.ts.

import { CS, FACILITY, SD, SNOMED, envMeta, idref, ref, uid } from './fhirBuild';
import { findEntity } from './state';
import type { FacilityState } from './state';

const ID = {
  mh: uid(1),
  task: uid(2),
  patient: uid(3),
  practitioner: uid(4),
  role: uid(5),
  appointment: uid(6),
  encounter: uid(7),
  procedure: uid(8),
  medication: uid(9),
  observation: uid(10),
};

const str = (v: Record<string, unknown>, k: string, fallback = ''): string =>
  typeof v[k] === 'string' && v[k] !== '' ? (v[k] as string) : fallback;
const cc = (v: Record<string, unknown>, k: string): Record<string, unknown> | undefined =>
  v[k] && typeof v[k] === 'object' ? (v[k] as Record<string, unknown>) : undefined;

export interface CaseMessageOpts {
  eventCode: 'case-scheduled' | 'case-performed' | 'case-cancelled';
  businessStatus: 'booked' | 'performed' | 'cancelled' | 'entered-in-error';
  values: Record<string, unknown>;
  facility: FacilityState;
}

type Entry = { fullUrl: string; resource: Record<string, unknown> };

/** Build the message Bundle for a case event from the merged case values. */
export function buildCaseMessage(opts: CaseMessageOpts): Record<string, unknown> {
  const { values: v, facility, eventCode, businessStatus } = opts;
  const performed = businessStatus === 'performed';
  const cancelled = businessStatus === 'cancelled' || businessStatus === 'entered-in-error';

  const patient = findEntity(facility, 'patient', str(v, 'patient'));
  const surgeon = findEntity(facility, 'practitioner', str(v, 'surgeon'));
  const location = findEntity(facility, 'location', str(v, 'location'));
  const facilityId = location?.facilityId ?? facility.facilityId;
  const mrn = patient?.key ?? 'MRN-0001';
  const cpso = surgeon?.key ?? '12345';
  const caseId = str(v, 'caseId', 'CASE-0001');

  const procedureCode = cc(v, 'procedureCode') ?? {
    coding: [{ system: `${CS}/WTIS-procedure-code`, code: 'W.CRD.ABL', display: 'Cardiac - Ablation' }],
  };
  const priority = cc(v, 'priority') ?? {
    coding: [{ system: `${CS}/surgical-priority-classification`, code: 'P1D', display: 'Access within 2-7 days' }],
  };
  const encounterClass = cc(v, 'encounterClass');
  const start = str(v, 'periodStart', '2025-06-02T07:30:00-04:00');
  const end = str(v, 'periodEnd', '2025-06-02T09:40:00-04:00');

  const entries: Entry[] = [];

  // MessageHeader leads.
  entries.push({
    fullUrl: ID.mh,
    resource: {
      resourceType: 'MessageHeader',
      meta: { profile: [`${SD}/ca-on-seris-profile-MessageHeader`] },
      eventCoding: { system: `${CS}/message-event-code`, code: eventCode },
      source: { endpoint: 'https://his.hospital.example/fhir' },
      focus: [ref(ID.task)],
    },
  });

  // Task carries the business status.
  entries.push({
    fullUrl: ID.task,
    resource: {
      resourceType: 'Task',
      meta: { profile: [`${SD}/ca-on-seris-profile-Task`] },
      status: 'completed',
      basedOn: [ref(ID.appointment), ref(ID.encounter)],
      businessStatus: { coding: [{ system: `${CS}/business-status`, code: businessStatus }] },
    },
  });

  // Patient.
  entries.push({
    fullUrl: ID.patient,
    resource: {
      resourceType: 'Patient',
      meta: envMeta('Patient', facilityId),
      identifier: [
        {
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] },
          system: 'http://hospital.example/mrn',
          value: mrn,
        },
      ],
      name: [
        {
          family: str(patient?.values ?? {}, 'name.family', 'Chalmers'),
          given: [str(patient?.values ?? {}, 'name.given', 'Peter')],
        },
      ],
      gender: 'male',
      birthDate: '1974-12-25',
    },
  });

  // Practitioner (surgeon).
  entries.push({
    fullUrl: ID.practitioner,
    resource: {
      resourceType: 'Practitioner',
      meta: envMeta('Practitioner', facilityId),
      identifier: [{ system: 'http://example.org/cpso', value: cpso }],
      name: [
        {
          family: str(surgeon?.values ?? {}, 'name.family', 'Careful'),
          given: [str(surgeon?.values ?? {}, 'name.given', 'Adam')],
          prefix: ['Dr'],
        },
      ],
    },
  });

  // PractitionerRole ties the surgeon to a service.
  entries.push({
    fullUrl: ID.role,
    resource: {
      resourceType: 'PractitionerRole',
      meta: envMeta('PractitionerRole', facilityId),
      practitioner: ref(ID.practitioner),
      specialty: [{ coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] }],
    },
  });

  // Appointment.
  entries.push({
    fullUrl: ID.appointment,
    resource: {
      resourceType: 'Appointment',
      meta: envMeta('Appointment', facilityId),
      identifier: [{ system: 'http://hospital.example/appointments', value: caseId }],
      status: cancelled ? 'cancelled' : 'booked',
      reasonReference: [ref(ID.procedure)],
      participant: [{ actor: idref('http://hospital.example/mrn', mrn), status: 'accepted' }],
    },
  });

  // Encounter.
  const encounter: Record<string, unknown> = {
    resourceType: 'Encounter',
    meta: envMeta('Encounter', facilityId),
    status: performed ? 'finished' : cancelled ? 'cancelled' : 'planned',
    class: encounterClass?.coding
      ? (encounterClass.coding as unknown[])[0]
      : { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [
      cc(v, 'encounterType') ?? { coding: [{ system: 'http://cihi.ca/fhir/CodeSystem/aac-admit-category', code: 'L', display: 'Elective' }] },
    ],
    priority,
    subject: ref(ID.patient),
    appointment: [ref(ID.appointment)],
    period: { start, ...(performed ? { end } : {}) },
    reasonReference: [ref(ID.procedure)],
  };
  if (cancelled) {
    const reason = cc(v, 'cancellationReason') ?? {
      coding: [{ system: `${CS}/surgery-cancellation-reason`, code: 'advw-104', display: 'Adverse Weather - Patient' }],
    };
    encounter.extension = [
      {
        url: `${SD}/ca-on-seris-ext-cancellation`,
        extension: [
          { url: 'CancellationReason', valueCodeableConcept: reason },
          { url: 'CancellationDate', valueDateTime: str(v, 'cancellationDate', '2025-06-01T16:20:00-04:00') },
        ],
      },
    ];
  }
  entries.push({ fullUrl: ID.encounter, resource: encounter });

  // Procedure.
  const procedure: Record<string, unknown> = {
    resourceType: 'Procedure',
    meta: envMeta('Procedure', facilityId),
    extension: [{ url: `${SD}/ca-on-seris-ext-in-room`, valuePeriod: { start: '2025-06-02T08:05:00-04:00', end: '2025-06-02T09:40:00-04:00' } }],
    status: performed ? 'completed' : 'preparation',
    category: [{ coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] }],
    code: procedureCode,
    subject: ref(ID.patient),
    encounter: ref(ID.encounter),
    performer: [{ actor: ref(ID.role) }],
    location: idref(FACILITY, facilityId),
  };
  if (performed) procedure.performedPeriod = { start: str(v, 'performedStart', '2025-06-02T08:20:00-04:00'), end: str(v, 'performedEnd', '2025-06-02T09:25:00-04:00') };
  entries.push({ fullUrl: ID.procedure, resource: procedure });

  // Performed messages also carry anaesthesia + an observation.
  if (performed) {
    entries.push({
      fullUrl: ID.medication,
      resource: {
        resourceType: 'MedicationAdministration',
        meta: envMeta('MedicationAdministration', facilityId),
        status: 'completed',
        medicationCodeableConcept: cc(v, 'anaesthesia') ?? { coding: [{ system: SNOMED, code: '50697003', display: 'General anesthesia' }] },
        subject: ref(ID.patient),
        effectiveDateTime: '2025-06-02T08:10:00-04:00',
        partOf: [ref(ID.procedure)],
      },
    });
    entries.push({
      fullUrl: ID.observation,
      resource: {
        resourceType: 'Observation',
        meta: envMeta('Observation', facilityId),
        status: 'final',
        code: { coding: [{ system: SNOMED, code: '302132005', display: 'American Society of Anesthesiologists physical status' }] },
        valueCodeableConcept: cc(v, 'asa') ?? { coding: [{ system: `${CS}/asa-physical-status`, code: 'ASA II' }] },
        subject: ref(ID.patient),
        partOf: [ref(ID.procedure)],
      },
    });
  }

  return {
    resourceType: 'Bundle',
    id: '11111111-2222-3333-4444-555555555555',
    meta: envMeta('Bundle', facilityId),
    identifier: { system: 'urn:ietf:rfc:3986', value: `urn:uuid:${caseId.toLowerCase()}-msg` },
    type: 'message',
    timestamp: '2025-06-02T10:00:00-04:00',
    entry: entries,
  };
}
