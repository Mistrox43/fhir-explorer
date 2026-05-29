import { ORIENTATION } from './data';
import type { ArtifactRef, OrientationStep } from './types';
import {
  capabilityByName,
  codeSystemByName,
  extensionByName,
  profileByName,
  valueSetByName,
} from '../fhir/spec';

export { ORIENTATION };
export type { OrientationStep } from './types';

/** Every step across both tracks, indexed by id. */
export const stepById = new Map<string, OrientationStep>(
  ORIENTATION.tracks.flatMap((t) => t.steps).map((s) => [s.id, s]),
);

/** The curated key-journey steps, in order. */
export const keyJourneySteps: OrientationStep[] = ORIENTATION.keyJourneyStepIds
  .map((id) => stepById.get(id))
  .filter((s): s is OrientationStep => Boolean(s));

/** True if an artifact reference resolves to something in the loaded SPEC. */
export function artifactExists(ref: ArtifactRef): boolean {
  switch (ref.kind) {
    case 'profile':
      return profileByName.has(ref.name);
    case 'extension':
      return extensionByName.has(ref.name);
    case 'valueSet':
      return valueSetByName.has(ref.name);
    case 'codeSystem':
      return codeSystemByName.has(ref.name);
    case 'capability':
      return capabilityByName.has(ref.name);
    default:
      return false;
  }
}

// Dev-time integrity check: warn if the curated narrative references an
// artifact (or key-journey step) that no longer exists in the package data.
if (import.meta.env.DEV) {
  const problems: string[] = [];
  for (const id of ORIENTATION.keyJourneyStepIds) {
    if (!stepById.has(id)) problems.push(`key-journey step id "${id}" not found`);
  }
  for (const track of ORIENTATION.tracks) {
    for (const stage of track.stages) {
      for (const id of stage.stepIds) {
        if (!stepById.has(id)) problems.push(`stage "${stage.title}" references missing step "${id}"`);
      }
    }
    for (const step of track.steps) {
      if (step.primaryProfile && !profileByName.has(step.primaryProfile)) {
        problems.push(`step "${step.id}" primaryProfile "${step.primaryProfile}" not in SPEC`);
      }
      for (const ref of step.artifacts) {
        if (!artifactExists(ref)) problems.push(`step "${step.id}" → unknown ${ref.kind} "${ref.name}"`);
      }
    }
  }
  if (problems.length) {
    console.warn(`[orientation] ${problems.length} unresolved reference(s):\n  ${problems.join('\n  ')}`);
  }
}
