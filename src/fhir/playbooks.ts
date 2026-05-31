// Troubleshooting playbooks: title / symptom -> cause -> fix, keyed to the
// structured finding `code`s the checker produces. Backend/transport problems
// are flagged out-of-scope (the tool can't see live endpoints or repository logs).

export interface Playbook {
  id: string;
  /** Finding codes this playbook addresses. */
  codes: string[];
  title: string;
  symptom: string;
  cause: string;
  fix: string;
  scope: 'spec' | 'transport';
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'unknown-resource-type',
    codes: ['unknown-resource-type'],
    title: 'Misspelled / unknown resourceType',
    symptom: 'The resourceType is not a FHIR R4 resource type (e.g. "Bundel").',
    cause: 'A typo or a non-FHIR type. The repository keys everything off resourceType, so it cannot route the resource.',
    fix: 'Correct resourceType to the intended FHIR resource (the checker suggests the closest match).',
    scope: 'spec',
  },
  {
    id: 'missing-resource-type',
    codes: ['missing-resource-type', 'not-json'],
    title: 'Missing / invalid resource',
    symptom: 'No resourceType, or the payload is not a JSON object.',
    cause: 'Every FHIR resource is a JSON object with a resourceType.',
    fix: 'Wrap the data in a JSON object and add the correct resourceType.',
    scope: 'spec',
  },
  {
    id: 'unknown-element',
    codes: ['unknown-element'],
    title: 'Unknown / misspelled element',
    symptom: 'A top-level field is not an element of this resource (e.g. "stauts").',
    cause: 'A misspelled element name, or a field that does not belong on this resource — FHIR servers silently ignore unknown elements, so the data is lost.',
    fix: 'Rename to the intended element (the checker suggests the closest match) or remove the stray field.',
    scope: 'spec',
  },
  {
    id: 'literal-ref',
    codes: ['reference-identifier-missing'],
    title: 'Reference missing its business identifier',
    symptom: 'A reference’s required .identifier is missing (schedule.identifier, actor.identifier, location.identifier, partOf.identifier).',
    cause: 'SERIS is message-based with no shared FHIR server, so references are made by business identifier — not literal "Type/id" URLs.',
    fix: 'Send the reference as { "identifier": { "system": …, "value": … } }. The facility-pointing ones use the Infoway facility-id system.',
    scope: 'spec',
  },
  {
    id: 'missing-required',
    codes: ['required-missing'],
    title: 'Required element missing',
    symptom: 'A min = 1 element the SERIS profile mandates was left out.',
    cause: 'Commonly meta.tag (facility id), identifier.system/value, or a status.',
    fix: 'Add the element. The profile’s Checklist tab lists every required + must-support field; meta.tag carries the facility id and meta.security is HTEST.',
    scope: 'spec',
  },
  {
    id: 'fixed-mismatch',
    codes: ['fixed-mismatch'],
    title: 'Fixed value not met',
    symptom: 'An element whose value SERIS fixes carries the wrong value.',
    cause: 'e.g. Bundle.type must be "message", Procedure.code.system must be the WTIS system, Location.type.system must be v3-RoleCode.',
    fix: 'Set the exact value shown in the error message.',
    scope: 'spec',
  },
  {
    id: 'unbound-code',
    codes: ['unbound-code'],
    title: 'Code not in the bound value set',
    symptom: 'A coded value falls outside the value set the element binds.',
    cause: 'A required binding makes this an error; extensible makes it a warning.',
    fix: 'Pick a valid code — the Build mode code picker and the value-set views list every enumerated code. Decode an unknown code with ⌘/Ctrl-K.',
    scope: 'spec',
  },
  {
    id: 'cardinality',
    codes: ['cardinality'],
    title: 'Cardinality exceeded',
    symptom: 'More repetitions were sent than the profile allows.',
    cause: 'An element constrained to a maximum was sent more times (often a max = 1 element sent as an array).',
    fix: 'Trim to the maximum shown in the error.',
    scope: 'spec',
  },
  {
    id: 'must-support-absent',
    codes: ['must-support-absent'],
    title: 'Must-support element absent',
    symptom: 'A must-support element is not present.',
    cause: 'Senders must be capable of supplying must-support elements; omitting one is only valid when the data is genuinely absent.',
    fix: 'Populate it when you have the data; otherwise this is informational, not an error.',
    scope: 'spec',
  },
  {
    id: 'unknown-extension',
    codes: ['unknown-extension'],
    title: 'Unknown extension URL',
    symptom: 'An extension URL is not defined in this IG.',
    cause: 'A typo in the extension url, or a non-SERIS extension.',
    fix: 'Use one of the IG’s extensions (browse them in Reference) or remove it.',
    scope: 'spec',
  },
  {
    id: 'message-structure',
    codes: ['message-not-bundle', 'message-type', 'message-no-header'],
    title: 'Message envelope is malformed',
    symptom: 'The Bundle is not a message, or does not lead with a MessageHeader.',
    cause: 'A SERIS submission is a message Bundle (type = "message") whose first entry is a MessageHeader pointing at the case Task.',
    fix: 'Assemble the envelope in Build mode — it locks type, the leading MessageHeader, fullUrls and focus correctly.',
    scope: 'spec',
  },
  {
    id: 'unresolved-reference',
    codes: ['unresolved-reference'],
    title: 'Unresolved intra-bundle reference',
    symptom: 'A reference (e.g. MessageHeader.focus) points at a urn:uuid that is not an entry in the Bundle.',
    cause: 'A fullUrl / reference mismatch when wiring the message together.',
    fix: 'Make every intra-bundle reference match an entry.fullUrl exactly (the Build assembler does this with urn:uuid).',
    scope: 'spec',
  },
  {
    id: 'state-mismatch',
    codes: ['state-mismatch'],
    title: 'Status doesn’t match the business state',
    symptom: 'Encounter.status / Task.businessStatus is inconsistent with the message event.',
    cause: 'booked ↔ planned, performed ↔ finished, cancelled ↔ cancelled.',
    fix: 'Align the status with the event code and businessStatus — see the Lifecycle view.',
    scope: 'spec',
  },
  {
    id: 'no-profile',
    codes: ['no-profile'],
    title: 'Resource not profiled by SERIS',
    symptom: 'A valid FHIR resource that SERIS does not profile.',
    cause: 'Only the 15 SERIS profiles are checkable here.',
    fix: 'Confirm this resource type is part of your SERIS submission; if so, there is nothing for this tool to check.',
    scope: 'spec',
  },
  {
    id: 'transport',
    codes: ['transport'],
    title: 'Transport / endpoint problem',
    symptom: 'Rejected at the endpoint, an auth/TLS error, or no correlation id came back.',
    cause: 'A transport or repository problem — not a spec conformance issue. This tool cannot see live endpoints, authentication, or repository logs.',
    fix: 'Escalate to the connectivity/transport team. Confirm the create-only contract and environment endpoints in the Connectivity guide (Reference → CapabilityStatement).',
    scope: 'transport',
  },
];

const byCode = new Map<string, Playbook>();
for (const p of PLAYBOOKS) for (const c of p.codes) byCode.set(c, p);

/** Map a finding (by code, then message fallback) to the most relevant playbook. */
export function matchPlaybook(finding: { code?: string; message: string }): Playbook | undefined {
  if (finding.code && byCode.has(finding.code)) return byCode.get(finding.code);
  const m = finding.message.toLowerCase();
  if (m.includes('identifier') && m.includes('missing')) return byCode.get('reference-identifier-missing');
  if (m.includes('required element is missing')) return byCode.get('required-missing');
  if (m.includes('fixed') || m.includes('expected')) return byCode.get('fixed-mismatch');
  if (m.includes('value set')) return byCode.get('unbound-code');
  if (m.includes('cardinality')) return byCode.get('cardinality');
  return undefined;
}
