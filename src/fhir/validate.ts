// A client-side, structural SERIS-profile conformance checker. It walks a
// profile's *differential* elements (the constraints SERIS adds) and checks a
// pasted instance against them. It is deliberately NOT a full FHIR R4
// validator: the package carries no FHIRPath invariants, no maxLength/min-max
// value, and only differentials — so this checks what SERIS asserts and is
// explicit (provenance = 'not-checked') about what it cannot see.
//
// It also catches obvious mistakes: a misspelled resourceType (Bundel) or an
// unknown/misspelled top-level element (stauts) get an explicit "did you mean…"
// finding, using the base-FHIR element names vendored in the generated profile.

import { SPEC, profileByName, valueSetByName, valueSetByUrl } from './spec';
import type { Profile, ProfileElement, ValueSetDef } from './types';
import { ELEMENT_SHAPES } from '../generated/shapes';

export type Severity = 'error' | 'warning' | 'info' | 'pass';

export interface Finding {
  severity: Severity;
  /** Stable category for grouping / playbook matching, e.g. 'unknown-resource-type'. */
  code: string;
  path: string;
  message: string;
  /** A did-you-mean target or the expected value, for specific advice. */
  suggestion?: string;
  /** 'seris' = asserted by the SERIS profile; 'not-checked' = boundary note. */
  provenance: 'seris' | 'not-checked';
}

export interface ValidationResult {
  ok: boolean;
  resourceType?: string;
  profileName?: string;
  matchedBy: 'meta.profile' | 'resourceType' | 'none';
  findings: Finding[];
  counts: Record<Severity, number>;
}

// ---- profile resolution indexes (built once) ----
const profileByUrl = new Map<string, Profile>(SPEC.profiles.map((p) => [p.url, p]));
const profileByBaseType = new Map<string, Profile>(SPEC.profiles.map((p) => [p.baseType, p]));
const allExtensionUrls = new Set<string>(SPEC.extensions.map((e) => e.url));
const bare = (u: string) => u.split('|')[0];

// The FHIR R4 resource type names, for did-you-mean on a misspelled resourceType.
const FHIR_R4_RESOURCE_TYPES = [
  'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
  'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
  'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
  'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse', 'ClinicalImpression',
  'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition', 'Composition',
  'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage', 'CoverageEligibilityRequest',
  'CoverageEligibilityResponse', 'DetectedIssue', 'Device', 'DeviceDefinition', 'DeviceMetric',
  'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport', 'DocumentManifest', 'DocumentReference',
  'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest', 'EnrollmentResponse',
  'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable', 'ExampleScenario',
  'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal', 'GraphDefinition', 'Group',
  'GuidanceResponse', 'HealthcareService', 'ImagingStudy', 'Immunization', 'ImmunizationEvaluation',
  'ImmunizationRecommendation', 'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library',
  'Linkage', 'List', 'Location', 'Measure', 'MeasureReport', 'Media', 'Medication',
  'MedicationAdministration', 'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest',
  'MedicationStatement', 'MedicinalProduct', 'MedicinalProductAuthorization',
  'MedicinalProductContraindication', 'MedicinalProductIndication', 'MedicinalProductIngredient',
  'MedicinalProductInteraction', 'MedicinalProductManufactured', 'MedicinalProductPackaged',
  'MedicinalProductPharmaceutical', 'MedicinalProductUndesirableEffect', 'MessageDefinition',
  'MessageHeader', 'MolecularSequence', 'NamingSystem', 'NutritionOrder', 'Observation',
  'ObservationDefinition', 'OperationDefinition', 'OperationOutcome', 'Organization',
  'OrganizationAffiliation', 'Parameters', 'Patient', 'PaymentNotice', 'PaymentReconciliation',
  'Person', 'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure', 'Provenance',
  'Questionnaire', 'QuestionnaireResponse', 'RelatedPerson', 'RequestGroup', 'ResearchDefinition',
  'ResearchElementDefinition', 'ResearchStudy', 'ResearchSubject', 'RiskAssessment',
  'RiskEvidenceSynthesis', 'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen',
  'SpecimenDefinition', 'StructureDefinition', 'StructureMap', 'Subscription', 'Substance',
  'SubstanceNucleicAcid', 'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation',
  'SubstanceSourceMaterial', 'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task',
  'TerminologyCapabilities', 'TestReport', 'TestScript', 'ValueSet', 'VerificationResult',
  'VisionPrescription',
];
const FHIR_TYPE_SET = new Set(FHIR_R4_RESOURCE_TYPES);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate a parsed FHIR resource against its SERIS profile. */
export function validateResource(input: unknown, forcedProfile?: string): ValidationResult {
  const findings: Finding[] = [];
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0, pass: 0 };
  const add = (f: Finding) => {
    findings.push(f);
    counts[f.severity]++;
  };

  if (!isObj(input)) {
    add({ severity: 'error', code: 'not-json', path: '(root)', message: 'Not a JSON object.', provenance: 'seris' });
    return { ok: false, matchedBy: 'none', findings, counts };
  }
  const resourceType = typeof input.resourceType === 'string' ? input.resourceType : undefined;
  if (!resourceType) {
    add({ severity: 'error', code: 'missing-resource-type', path: 'resourceType', message: 'Missing resourceType — every FHIR resource must declare one.', provenance: 'seris' });
    return { ok: false, matchedBy: 'none', findings, counts };
  }

  // Resolve the profile: forced > meta.profile > resourceType.
  let profile: Profile | undefined;
  let matchedBy: ValidationResult['matchedBy'] = 'none';
  if (forcedProfile) {
    profile = profileByName.get(forcedProfile);
    matchedBy = profile ? 'meta.profile' : 'none';
  }
  if (!profile) {
    for (const url of readProfileUrls(input)) {
      const hit = profileByUrl.get(bare(url));
      if (hit) {
        profile = hit;
        matchedBy = 'meta.profile';
        break;
      }
    }
  }
  if (!profile) {
    profile = profileByBaseType.get(resourceType);
    if (profile) matchedBy = 'resourceType';
  }

  if (!profile) {
    // No SERIS profile — is the resourceType even a real FHIR type? Catch typos.
    if (FHIR_TYPE_SET.has(resourceType)) {
      add({
        severity: 'info',
        code: 'no-profile',
        path: 'resourceType',
        message: `"${resourceType}" is a valid FHIR R4 resource but is not profiled by SERIS — nothing to check against.`,
        provenance: 'not-checked',
      });
    } else {
      const guess = closest(resourceType, FHIR_R4_RESOURCE_TYPES);
      if (guess) {
        add({
          severity: 'error',
          code: 'unknown-resource-type',
          path: 'resourceType',
          message: `"${resourceType}" is not a FHIR R4 resource type — did you mean "${guess}"?`,
          suggestion: guess,
          provenance: 'seris',
        });
      } else {
        add({
          severity: 'warning',
          code: 'unknown-resource-type',
          path: 'resourceType',
          message: `"${resourceType}" is not a recognized FHIR R4 resource type.`,
          provenance: 'seris',
        });
      }
    }
    return { ok: counts.error === 0, resourceType, matchedBy, findings, counts };
  }

  if (matchedBy === 'resourceType') {
    add({
      severity: 'info',
      code: 'boundary',
      path: 'meta.profile',
      message: `No meta.profile matched; checking against the SERIS ${profile.name} profile by resourceType.`,
      provenance: 'not-checked',
    });
  }

  // The resourceType must match the profile's base resource type. This catches a
  // misspelled resourceType (e.g. "Bndle") even when meta.profile resolved.
  if (resourceType !== profile.baseType) {
    add({
      severity: 'error',
      code: 'unknown-resource-type',
      path: 'resourceType',
      message: `resourceType is "${resourceType}" but ${
        matchedBy === 'meta.profile' ? 'meta.profile is' : 'this profile is'
      } for "${profile.baseType}". Set resourceType to "${profile.baseType}".`,
      suggestion: profile.baseType,
      provenance: 'seris',
    });
  }

  // Unknown / misspelled elements (did-you-mean), recursively.
  checkUnknownElements(input, profile, add);

  // Walk the differential. Skip sliced and extension elements (handled
  // separately / not generically checkable without false positives).
  let skippedSliced = 0;
  for (const el of profile.elements) {
    const segs = el.id.split('.').slice(1);
    if (segs.length === 0) continue;
    if (segs.some((s) => s.includes(':'))) {
      skippedSliced++;
      continue;
    }
    if (segs[0] === 'extension' || segs[0] === 'modifierExtension') continue;
    checkElement(input, el, segs, add);
  }

  // Top-level extensions: flag URLs unknown to the IG.
  const exts = input.extension;
  if (Array.isArray(exts)) {
    exts.forEach((e, i) => {
      const url = isObj(e) && typeof e.url === 'string' ? e.url : undefined;
      if (url && !allExtensionUrls.has(bare(url))) {
        add({
          severity: 'warning',
          code: 'unknown-extension',
          path: `extension[${i}].url`,
          message: `Extension URL is not defined in this IG: ${url}`,
          provenance: 'seris',
        });
      }
    });
  }

  // Honest boundary notes.
  if (skippedSliced > 0) {
    add({
      severity: 'info',
      code: 'boundary',
      path: '(boundary)',
      message: `${skippedSliced} sliced/extension constraint(s) (e.g. identifier slices) are shown in the Explorer but not auto-checked here.`,
      provenance: 'not-checked',
    });
  }
  add({
    severity: 'info',
    code: 'boundary',
    path: '(boundary)',
    message:
      'Structural SERIS-profile check only — not full FHIR R4. FHIRPath invariants, maxLength/value ranges, and base-FHIR mandatory datatype rules are not evaluated.',
    provenance: 'not-checked',
  });

  return { ok: counts.error === 0, resourceType, profileName: profile.name, matchedBy, findings, counts };
}

const STOP_TYPES = new Set(['Resource', 'DomainResource']);

/** Recursively flag instance keys that aren't valid elements (at any depth). */
function checkUnknownElements(input: Obj, profile: Profile, add: (f: Finding) => void) {
  if (!ELEMENT_SHAPES[profile.baseType]) return; // shapes not available — skip
  walkShape(input, profile.baseType, '', add, 0);
}

function walkShape(node: unknown, shapeKey: string, prefix: string, add: (f: Finding) => void, depth: number) {
  if (depth > 8 || !isObj(node)) return;
  const shape = ELEMENT_SHAPES[shapeKey];
  if (!shape) return;

  const names = Object.keys(shape);
  const plain = new Set<string>();
  const choiceBases: string[] = [];
  for (const n of names) {
    if (n.endsWith('[x]')) choiceBases.push(n.slice(0, -3));
    else plain.add(n);
  }
  const display = names.map((n) => (n.endsWith('[x]') ? n.slice(0, -3) : n));
  const typeLabel = shapeKey.split('.').pop();

  for (const key of Object.keys(node)) {
    if (key === 'resourceType' || key.startsWith('_')) continue; // root marker / primitive extension

    let matched: string | undefined;
    if (plain.has(key)) matched = key;
    else {
      const cb = choiceBases.find((b) => key === b || (key.startsWith(b) && key.length > b.length && /[A-Z]/.test(key[b.length])));
      if (cb) matched = `${cb}[x]`;
    }

    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (!matched) {
      const guess = closest(key, display);
      add({
        severity: 'warning',
        code: 'unknown-element',
        path: fullPath,
        message: guess
          ? `Unknown element "${fullPath}" — did you mean "${guess}"?`
          : `"${fullPath}" is not a recognized element of ${typeLabel}.`,
        suggestion: guess,
        provenance: 'seris',
      });
      continue;
    }

    // Recurse into complex children (skip ambiguous choices and stop-types).
    if (matched.endsWith('[x]')) continue;
    const childType = shape[matched];
    let childShape: string | undefined;
    if (childType === 'BackboneElement' || childType === 'Element') childShape = `${shapeKey}.${matched}`;
    else if (ELEMENT_SHAPES[childType] && !STOP_TYPES.has(childType)) childShape = childType;
    if (!childShape || !ELEMENT_SHAPES[childShape]) continue;

    const val = node[key];
    for (const item of Array.isArray(val) ? val : [val]) {
      if (isObj(item)) walkShape(item, childShape, fullPath, add, depth + 1);
    }
  }
}

function checkElement(root: Obj, el: ProfileElement, segs: string[], add: (f: Finding) => void) {
  const path = el.id;
  const parentNodes = traverse([root], segs.slice(0, -1));
  const parentPresent = parentNodes.length > 0;
  const leafVals = collect(parentNodes, segs[segs.length - 1]);
  const present = leafVals.some(nonEmpty);
  const isIdentifierRef = /\.identifier(\.(system|value))?$/.test(path);

  // Required
  if (el.min != null && el.min >= 1) {
    if (parentPresent && !present) {
      add({
        severity: 'error',
        code: isIdentifierRef ? 'reference-identifier-missing' : 'required-missing',
        path,
        message: 'Required element is missing.',
        provenance: 'seris',
      });
    } else if (present) {
      add({ severity: 'pass', code: 'pass', path, message: 'Required element present.', provenance: 'seris' });
    }
  }

  // Cardinality max (numeric)
  if (el.max && el.max !== '*') {
    const maxN = Number(el.max);
    if (!Number.isNaN(maxN)) {
      for (const v of leafVals) {
        if (Array.isArray(v) && v.length > maxN) {
          add({
            severity: 'error',
            code: 'cardinality',
            path,
            message: `Cardinality exceeded: max is ${maxN} but found ${v.length}.`,
            provenance: 'seris',
          });
        }
      }
    }
  }

  // Must-support presence (depth-1 only, to stay readable)
  if (el.mustSupport && segs.length === 1 && !present) {
    add({
      severity: 'info',
      code: 'must-support-absent',
      path,
      message: 'Must-support element not present (allowed only if the data is genuinely absent).',
      provenance: 'seris',
    });
  }

  if (!present) return;

  // Fixed / pattern
  if (el.fixed) {
    const expected = summarize(el.fixed.value);
    for (const v of leafVals) {
      if (!matchesFixed(v, el.fixed.value)) {
        add({
          severity: 'error',
          code: 'fixed-mismatch',
          path,
          message: `${el.fixed.kind === 'fixed' ? 'Fixed' : 'Pattern'} value not met. Expected ${expected}.`,
          suggestion: expected,
          provenance: 'seris',
        });
      } else {
        add({ severity: 'pass', code: 'pass', path, message: `Fixed value matches (${expected}).`, provenance: 'seris' });
      }
    }
  }

  // Binding membership
  if (el.binding && (el.binding.strength === 'required' || el.binding.strength === 'extensible')) {
    const vs = resolveValueSet(el.binding.valueSetUrl, el.binding.valueSetName);
    const codeSet = vs ? valueSetCodes(vs) : undefined;
    if (!codeSet) {
      add({
        severity: 'info',
        code: 'boundary',
        path,
        message: `Bound to ${el.binding.valueSetName ?? 'a value set'} (${el.binding.strength}) — membership not checkable client-side.`,
        provenance: 'not-checked',
      });
    } else {
      for (const c of leafVals.flatMap(extractCodes)) {
        if (c.code && !codeSet.has(c.code)) {
          add({
            severity: el.binding.strength === 'required' ? 'error' : 'warning',
            code: 'unbound-code',
            path,
            message: `Code "${c.code}" is not in the ${el.binding.strength} value set ${el.binding.valueSetName ?? ''}.`,
            suggestion: el.binding.valueSetName,
            provenance: 'seris',
          });
        } else if (c.code) {
          add({ severity: 'pass', code: 'pass', path, message: `Code "${c.code}" is valid for ${el.binding.valueSetName ?? 'the bound value set'}.`, provenance: 'seris' });
        }
      }
    }
  }
}

// ---- did-you-mean ----
/** Closest candidate within a small edit distance, or undefined. */
function closest(word: string, candidates: string[]): string | undefined {
  const w = word.toLowerCase();
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(w, c.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // Tolerance scales a little with length; cap at 2 for short names.
  const tol = Math.min(2, Math.floor(word.length / 4) + 1);
  return best && bestD > 0 && bestD <= tol ? best : undefined;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// ---- traversal helpers ----
function traverse(nodes: unknown[], segs: string[]): unknown[] {
  let cur = nodes;
  for (const seg of segs) cur = expand(collect(cur, seg));
  return cur;
}

function collect(nodes: unknown[], seg: string): unknown[] {
  const base = seg.replace(/\[x\]$/, '');
  const isChoice = seg.endsWith('[x]');
  const out: unknown[] = [];
  for (const n of nodes) {
    if (!isObj(n)) continue;
    if (isChoice) {
      for (const k of Object.keys(n)) {
        if (k === base || (k.startsWith(base) && k.length > base.length && /[A-Z]/.test(k[base.length]))) {
          out.push(n[k]);
        }
      }
    } else if (base in n) {
      out.push(n[base]);
    }
  }
  return out;
}

function expand(values: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const v of values) {
    if (Array.isArray(v)) out.push(...v);
    else if (v != null) out.push(v);
  }
  return out;
}

function nonEmpty(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// ---- coded value helpers ----
interface CodePair {
  system?: string;
  code?: string;
}
function extractCodes(value: unknown): CodePair[] {
  const out: CodePair[] = [];
  const handle = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string') {
      out.push({ code: v });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(handle);
      return;
    }
    if (isObj(v)) {
      if (Array.isArray(v.coding)) (v.coding as unknown[]).forEach((c) => isObj(c) && out.push({ system: c.system as string, code: c.code as string }));
      else if ('code' in v) out.push({ system: v.system as string, code: v.code as string });
    }
  };
  handle(value);
  return out;
}

function matchesFixed(value: unknown, fixed: unknown): boolean {
  if (typeof fixed === 'string') {
    if (typeof value === 'string') return value === fixed;
    return extractCodes(value).some((c) => c.code === fixed);
  }
  const fixedCodes = extractCodes(fixed);
  const valCodes = extractCodes(value);
  if (fixedCodes.length === 0) return JSON.stringify(value) === JSON.stringify(fixed);
  return fixedCodes.every((fc) => valCodes.some((vc) => vc.code === fc.code && (!fc.system || vc.system === fc.system)));
}

function resolveValueSet(url?: string, name?: string): ValueSetDef | undefined {
  if (url) {
    const hit = valueSetByUrl.get(bare(url));
    if (hit) return hit;
  }
  return name ? valueSetByName.get(name) : undefined;
}

function valueSetCodes(vs: ValueSetDef): Set<string> | undefined {
  const codes = new Set<string>();
  let hadConcepts = false;
  for (const inc of vs.includes) {
    for (const c of inc.concepts) {
      codes.add(c.code);
      hadConcepts = true;
    }
  }
  return hadConcepts ? codes : undefined;
}

function readProfileUrls(input: Obj): string[] {
  const meta = input.meta;
  if (isObj(meta) && Array.isArray(meta.profile)) return meta.profile.filter((p): p is string => typeof p === 'string');
  return [];
}

function summarize(v: unknown): string {
  if (typeof v === 'string') return v;
  const codes = extractCodes(v);
  if (codes.length) return codes.map((c) => `${c.system ? c.system + '#' : ''}${c.code}`).join(', ');
  return JSON.stringify(v);
}
