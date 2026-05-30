// A client-side, structural SERIS-profile conformance checker. It walks a
// profile's *differential* elements (the constraints SERIS adds) and checks a
// pasted instance against them. It is deliberately NOT a full FHIR R4
// validator: the package carries no FHIRPath invariants, no maxLength/min-max
// value, and only differentials — so this checks what SERIS asserts and is
// explicit (provenance = 'not-checked') about what it cannot see.

import { SPEC, profileByName, valueSetByName, valueSetByUrl } from './spec';
import type { Profile, ProfileElement, ValueSetDef } from './types';

export type Severity = 'error' | 'warning' | 'info' | 'pass';

export interface Finding {
  severity: Severity;
  path: string;
  message: string;
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
    add({ severity: 'error', path: '(root)', message: 'Not a JSON object.', provenance: 'seris' });
    return { ok: false, matchedBy: 'none', findings, counts };
  }
  const resourceType = typeof input.resourceType === 'string' ? input.resourceType : undefined;
  if (!resourceType) {
    add({ severity: 'error', path: 'resourceType', message: 'Missing resourceType.', provenance: 'seris' });
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
    const declared = readProfileUrls(input);
    for (const url of declared) {
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
    add({
      severity: 'info',
      path: 'meta.profile',
      message: `No SERIS profile matches resourceType "${resourceType}". Nothing to check against.`,
      provenance: 'not-checked',
    });
    return { ok: true, resourceType, matchedBy, findings, counts };
  }

  if (matchedBy === 'resourceType') {
    add({
      severity: 'info',
      path: 'meta.profile',
      message: `No meta.profile matched; checking against the SERIS ${profile.name} profile by resourceType.`,
      provenance: 'not-checked',
    });
  }

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
      path: '(boundary)',
      message: `${skippedSliced} sliced/extension constraint(s) (e.g. identifier slices) are shown in the Explorer but not auto-checked here.`,
      provenance: 'not-checked',
    });
  }
  add({
    severity: 'info',
    path: '(boundary)',
    message:
      'Structural SERIS-profile check only — not full FHIR R4. FHIRPath invariants, maxLength/value ranges, and base-FHIR mandatory datatype rules are not evaluated.',
    provenance: 'not-checked',
  });

  return { ok: counts.error === 0, resourceType, profileName: profile.name, matchedBy, findings, counts };
}

function checkElement(
  root: Obj,
  el: ProfileElement,
  segs: string[],
  add: (f: Finding) => void,
) {
  const path = el.id;
  const parentNodes = traverse([root], segs.slice(0, -1));
  const parentPresent = parentNodes.length > 0;
  const leafVals = collect(parentNodes, segs[segs.length - 1]);
  const present = leafVals.some(nonEmpty);

  // Required
  if (el.min != null && el.min >= 1) {
    if (parentPresent && !present) {
      add({ severity: 'error', path, message: `Required element is missing.`, provenance: 'seris' });
    } else if (present) {
      add({ severity: 'pass', path, message: 'Required element present.', provenance: 'seris' });
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
      path,
      message: 'Must-support element not present (allowed only if the data is genuinely absent).',
      provenance: 'seris',
    });
  }

  if (!present) return;

  // Fixed / pattern
  if (el.fixed) {
    for (const v of leafVals) {
      if (!matchesFixed(v, el.fixed.value)) {
        add({
          severity: 'error',
          path,
          message: `${el.fixed.kind === 'fixed' ? 'Fixed' : 'Pattern'} value not met. Expected ${summarize(el.fixed.value)}.`,
          provenance: 'seris',
        });
      } else {
        add({ severity: 'pass', path, message: `Fixed value matches (${summarize(el.fixed.value)}).`, provenance: 'seris' });
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
        path,
        message: `Bound to ${el.binding.valueSetName ?? 'a value set'} (${el.binding.strength}) — membership not checkable client-side.`,
        provenance: 'not-checked',
      });
    } else {
      const codes = leafVals.flatMap(extractCodes);
      for (const c of codes) {
        if (c.code && !codeSet.has(c.code)) {
          add({
            severity: el.binding.strength === 'required' ? 'error' : 'warning',
            path,
            message: `Code "${c.code}" is not in the ${el.binding.strength} value set ${el.binding.valueSetName ?? ''}.`,
            provenance: 'seris',
          });
        } else if (c.code) {
          add({ severity: 'pass', path, message: `Code "${c.code}" is valid for ${el.binding.valueSetName ?? 'the bound value set'}.`, provenance: 'seris' });
        }
      }
    }
  }
}

// ---- traversal helpers ----
function traverse(nodes: unknown[], segs: string[]): unknown[] {
  let cur = nodes;
  for (const seg of segs) {
    const vals = collect(cur, seg);
    cur = expand(vals);
  }
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
