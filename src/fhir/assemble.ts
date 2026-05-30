// Assembles a conformant SERIS message Bundle for a case event. The envelope
// (Bundle type=message, meta.tag/security, leading MessageHeader with the fixed
// event system, Task with businessStatus, urn:uuid fullUrls + wired focus) is
// locked correct; the case resources are seeded from the validated orientation
// examples. The result passes the Bundle Inspector.

import { stepById } from '../orientation';

const SD = 'http://ontariohealth.ca/fhir/StructureDefinition';
const CS = 'http://ontariohealth.ca/fhir/CodeSystem';
const FACILITY = 'https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-health-care-facility-id';
const profileUrl = (n: string) => `${SD}/ca-on-seris-profile-${n}`;

export interface MessageEvent {
  code: string;
  display: string;
  business: string;
  stepId: string;
  /** A value set worth picking a code from for this event (for the Code Picker). */
  codePickVs: string;
}

export const MESSAGE_EVENTS: MessageEvent[] = [
  { code: 'case-scheduled', display: 'Case scheduled', business: 'booked', stepId: 'case-book', codePickVs: 'SurgicalPriorityClassification' },
  { code: 'case-performed', display: 'Case performed', business: 'performed', stepId: 'case-perform', codePickVs: 'AnaesthesiaType' },
  { code: 'case-cancelled', display: 'Case cancelled', business: 'cancelled', stepId: 'case-cancel', codePickVs: 'SurgeryCancellationReason' },
];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const uid = (n: number) => `urn:uuid:11111111-1111-1111-1111-${String(n).padStart(12, '0')}`;

function envMeta(name: string) {
  return {
    profile: [profileUrl(name)],
    security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'HTEST' }],
    tag: [{ system: FACILITY, code: '4001' }],
  };
}

export function assembleMessage(code: string): Record<string, unknown> | null {
  const ev = MESSAGE_EVENTS.find((e) => e.code === code);
  if (!ev) return null;

  const seed = stepById.get(ev.stepId)?.example?.json as Record<string, unknown> | undefined;
  const caseRes = seed ? clone(seed) : { resourceType: 'Encounter', meta: { profile: [profileUrl('Encounter')] } };

  const mhUrl = uid(0);
  const taskUrl = uid(1);
  const caseUrl = uid(2);

  const messageHeader = {
    resourceType: 'MessageHeader',
    meta: { profile: [profileUrl('MessageHeader')] },
    eventCoding: { system: `${CS}/message-event-code`, code: ev.code, display: ev.display },
    source: { endpoint: 'https://his.hospital.example/fhir' },
    focus: [{ reference: taskUrl }],
  };

  const task = {
    resourceType: 'Task',
    meta: { profile: [profileUrl('Task')] },
    status: 'completed',
    // Task.basedOn is exactly 2 references (the booking + the case); here both
    // point at the case resource in this starter — set real Appointment +
    // Encounter references in your system.
    basedOn: [{ reference: caseUrl }, { reference: caseUrl }],
    businessStatus: { coding: [{ system: `${CS}/business-status`, code: ev.business }] },
  };

  return {
    resourceType: 'Bundle',
    meta: envMeta('Bundle'),
    identifier: { system: 'http://hospital.example/messages', value: `MSG-${ev.code}-0001` },
    type: 'message',
    timestamp: '2025-06-02T10:00:00-04:00',
    entry: [
      { fullUrl: mhUrl, resource: messageHeader },
      { fullUrl: taskUrl, resource: task },
      { fullUrl: caseUrl, resource: caseRes },
    ],
  };
}
