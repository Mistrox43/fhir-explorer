// Troubleshooting playbooks: symptom -> cause -> fix, keyed to the kinds of
// finding the conformance checker produces. Backend/transport problems are
// flagged out-of-scope (the tool can't see live endpoints or repository logs).

export interface Playbook {
  id: string;
  symptom: string;
  cause: string;
  fix: string;
  scope: 'spec' | 'transport';
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'literal-ref',
    symptom: 'A reference’s required .identifier is missing (e.g. schedule.identifier, actor.identifier, location.identifier, partOf.identifier).',
    cause: 'SERIS is message-based with no shared FHIR server, so references are made by business identifier — not literal "Type/id" URLs.',
    fix: 'Send the reference as { "identifier": { "system": …, "value": … } }. The facility-pointing ones use the Infoway facility-id system.',
    scope: 'spec',
  },
  {
    id: 'missing-required',
    symptom: 'Required element is missing.',
    cause: 'A min=1 element the SERIS profile mandates was left out (commonly meta.tag, identifier.system/value, or a status).',
    fix: 'Add the element. The profile’s Checklist tab lists every required + must-support field; meta.tag carries the facility id and meta.security is HTEST.',
    scope: 'spec',
  },
  {
    id: 'fixed-mismatch',
    symptom: 'Fixed value not met.',
    cause: 'An element whose value SERIS fixes carries the wrong value — e.g. Bundle.type must be "message", Procedure.code.system must be the WTIS system, Location.type.system must be v3-RoleCode.',
    fix: 'Set the exact value shown in the error message.',
    scope: 'spec',
  },
  {
    id: 'unbound-code',
    symptom: 'A code is not in the bound value set.',
    cause: 'A coded value falls outside the value set the element binds. A required binding makes this an error; extensible makes it a warning.',
    fix: 'Pick a valid code — the Build mode code picker and the value-set views list every enumerated code. Decode an unknown code with ⌘/Ctrl-K.',
    scope: 'spec',
  },
  {
    id: 'cardinality',
    symptom: 'Cardinality exceeded.',
    cause: 'More repetitions were sent than the profile allows (e.g. an element constrained to max = 1 sent as an array).',
    fix: 'Trim to the maximum shown in the error.',
    scope: 'spec',
  },
  {
    id: 'state-mismatch',
    symptom: 'The resource status doesn’t match the message’s business state.',
    cause: 'Encounter.status / Task.businessStatus is inconsistent with the message event (booked ↔ planned, performed ↔ finished, cancelled ↔ cancelled).',
    fix: 'Align the status with the event code and Task.businessStatus. See the Lifecycle view for the state machine.',
    scope: 'spec',
  },
  {
    id: 'transport',
    symptom: 'Rejected at the endpoint, an auth/TLS error, or no correlation id came back.',
    cause: 'A transport or repository problem — not a spec conformance issue. This tool cannot see live endpoints, authentication, or repository logs.',
    fix: 'Escalate to the connectivity/transport team. Confirm the create-only contract and environment endpoints in the Connectivity guide (Reference → CapabilityStatement).',
    scope: 'transport',
  },
];

const byId = (id: string) => PLAYBOOKS.find((p) => p.id === id);

/** Map a checker finding message to the most relevant playbook. */
export function matchPlaybook(message: string): Playbook | undefined {
  const m = message.toLowerCase();
  if (m.includes('required element is missing') && m.includes('identifier')) return byId('literal-ref');
  if (m.includes('required element is missing')) return byId('missing-required');
  if (m.includes('fixed value not met') || m.includes('expected')) return byId('fixed-mismatch');
  if (m.includes('not in the') && m.includes('value set')) return byId('unbound-code');
  if (m.includes('cardinality exceeded')) return byId('cardinality');
  return undefined;
}
