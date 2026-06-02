// Shared FHIR-assembly primitives used by the Simulator's resource/message
// builders. These mirror the constants and helpers that src/fhir/assemble.ts and
// src/fhir/scheduleRest.ts use to produce conformant SERIS payloads, so the
// simulator emits exactly the same envelope shape — just parametrized by the
// user's inputs and the running facility state.

export const SD = 'http://ontariohealth.ca/fhir/StructureDefinition';
export const CS = 'http://ontariohealth.ca/fhir/CodeSystem';
export const SNOMED = 'http://snomed.info/sct';
export const FACILITY = 'https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-health-care-facility-id';

/** Canonical URL of a SERIS profile by short name, e.g. profileUrl('Slot'). */
export const profileUrl = (name: string) => `${SD}/ca-on-seris-profile-${name}`;
/** Canonical URL of a SERIS/SETP extension by slug, e.g. extUrl('ca-on-seris-ext-block'). */
export const extUrl = (slug: string) => `${SD}/${slug}`;

/** A literal Reference. */
export const ref = (u: string) => ({ reference: u });
/** A reference by business identifier (how SERIS points at the OR Location, schedules, etc.). */
export const idref = (system: string, value: string) => ({ identifier: { system, value } });

/**
 * The required SERIS envelope on `meta`: the profile claim, the HTEST security
 * label, and the facility-id tag. Defaults to facility 4001 to match the fixed
 * Build samples; the simulator passes the chosen site's id.
 */
export const envMeta = (name: string, facilityId = '4001') => ({
  profile: [profileUrl(name)],
  security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'HTEST' }],
  tag: [{ system: FACILITY, code: facilityId }],
});

/** Deterministic urn:uuid for the nth entry of a message Bundle. */
export const uid = (n: number) => `urn:uuid:11111111-1111-1111-1111-${String(n).padStart(12, '0')}`;

/** Build a CodeableConcept from a system/code/display (omitting empty fields). */
export function concept(system: string, code: string, display?: string) {
  const coding: Record<string, string> = { system, code };
  if (display) coding.display = display;
  return { coding: [coding] };
}
