// Types for the guided Orientation — a business-workflow narrative that maps
// real-world SERIS surgical events to the FHIR artifacts in the loaded SPEC.
// Business descriptions are hand-authored summaries of the IG's Business
// Context > Use Cases page; every artifact reference is validated against SPEC.

import type { ArtifactKind } from '../fhir/spec';
import type { TemplateExample } from '../fhir/types';

/** A reference to a SERIS artifact, rendered as a clickable chip. */
export interface ArtifactRef {
  kind: ArtifactKind;
  name: string;
  /** Optional grouping label, e.g. "Produces" or "Key codes". */
  group?: 'produces' | 'codes' | 'extends';
}

/** One business event / use case in a workflow track. */
export interface OrientationStep {
  id: string;
  /** IG use-case reference, e.g. "OR Schedule · UC2". */
  ucRef?: string;
  title: string;
  /** Plain-language description of the real-world business event. */
  event: string;
  actor: string;
  /** The FHIR action, e.g. "POST" or "message". */
  action?: string;
  /** For case steps: the Encounter/business state this event sets. */
  caseState?: 'booked' | 'performed' | 'cancelled' | 'entered-in-error';
  artifacts: ArtifactRef[];
  /** Profile whose generated template is embedded under the step. */
  primaryProfile?: string;
  /** A hand-authored, grounded example payload for this event. */
  example?: TemplateExample;
}

/** A grouping of steps within a track. */
export interface OrientationStage {
  title: string;
  stepIds: string[];
}

/** One workflow track (OR Schedule or OR Case). */
export interface OrientationTrack {
  id: 'schedule' | 'case';
  title: string;
  summary: string;
  stages: OrientationStage[];
  steps: OrientationStep[];
}

/** A curated end-to-end scenario the player walks through, step by step. */
export interface Scenario {
  id: string;
  title: string;
  summary: string;
  /** Ordered step ids (from the tracks) the player walks. */
  stepIds: string[];
}

/** The whole orientation content set. */
export interface OrientationContent {
  intro: {
    headline: string;
    what: string;
    actors: { name: string; role: string }[];
    dataFlow: string;
    howToUse: string;
  };
  /** Ordered step ids forming the curated end-to-end story. */
  keyJourneyStepIds: string[];
  /** Curated end-to-end scenarios for the player. */
  scenarios: Scenario[];
  tracks: OrientationTrack[];
  /** Link to the IG page the narrative is summarised from. */
  sourceUrl: string;
}
