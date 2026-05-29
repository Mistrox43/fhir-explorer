import { SPEC } from '../generated/seris';
import type {
  CapabilityStatementDef,
  CodeSystemDef,
  ExtensionDef,
  Profile,
  ValueSetDef,
} from './types';

export { SPEC };

/** The kinds of artifact a user can select in the sidebar. */
export type ArtifactKind = 'profile' | 'extension' | 'valueSet' | 'codeSystem' | 'capability';

export interface Selection {
  kind: ArtifactKind;
  name: string;
}

export const profileByName = new Map<string, Profile>(SPEC.profiles.map((p) => [p.name, p]));
export const extensionByName = new Map<string, ExtensionDef>(
  SPEC.extensions.map((e) => [e.name, e]),
);
export const valueSetByName = new Map<string, ValueSetDef>(SPEC.valueSets.map((v) => [v.name, v]));
export const valueSetByUrl = new Map<string, ValueSetDef>(SPEC.valueSets.map((v) => [v.url, v]));
export const codeSystemByName = new Map<string, CodeSystemDef>(
  SPEC.codeSystems.map((c) => [c.name, c]),
);
export const capabilityByName = new Map<string, CapabilityStatementDef>(
  SPEC.capabilityStatements.map((c) => [c.name, c]),
);

export const profileNames = new Set(SPEC.profiles.map((p) => p.name));
