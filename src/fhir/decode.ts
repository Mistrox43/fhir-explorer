import { SPEC } from './spec';
import { ORIENTATION } from '../orientation';

// Reverse lookup for a code/fragment: where is it defined, what binds it, and
// which business event emits it. Powers the Code & Error Decoder. Everything is
// derived once from the in-memory SPEC + orientation content.

export interface CodeMatch {
  code: string;
  display?: string;
  owner: string;
  ownerKind: 'valueSet' | 'codeSystem';
  system?: string;
}
export interface BindingUse {
  profile: string;
  elementId: string;
  strength: string;
  valueSet: string;
}
export interface EmittingStep {
  id: string;
  title: string;
  ucRef?: string;
  valueSet: string;
}
export interface DecodeResult {
  query: string;
  matches: CodeMatch[];
  bindings: BindingUse[];
  steps: EmittingStep[];
}

// code -> value-set names that enumerate it
const valueSetsByCode = new Map<string, Set<string>>();
const addVsCode = (code: string, vs: string) => {
  const s = valueSetsByCode.get(code) ?? new Set<string>();
  s.add(vs);
  valueSetsByCode.set(code, s);
};
for (const vs of SPEC.valueSets) {
  for (const inc of vs.includes) for (const c of inc.concepts) addVsCode(c.code, vs.name);
}

// value-set name -> elements that bind it (at what strength)
const bindingsByValueSet = new Map<string, BindingUse[]>();
for (const p of SPEC.profiles) {
  for (const el of p.elements) {
    const name = el.binding?.valueSetName;
    if (!name) continue;
    const list = bindingsByValueSet.get(name) ?? [];
    list.push({ profile: p.name, elementId: el.id, strength: el.binding!.strength, valueSet: name });
    bindingsByValueSet.set(name, list);
  }
}

// value-set name -> orientation steps that emit it
const stepsByValueSet = new Map<string, EmittingStep[]>();
for (const track of ORIENTATION.tracks) {
  for (const step of track.steps) {
    for (const a of step.artifacts) {
      if (a.kind !== 'valueSet') continue;
      const list = stepsByValueSet.get(a.name) ?? [];
      list.push({ id: step.id, title: step.title, ucRef: step.ucRef, valueSet: a.name });
      stepsByValueSet.set(a.name, list);
    }
  }
}

/** Decode an exact code (case-insensitive) into its definitions + usage. */
export function decodeCode(query: string): DecodeResult {
  const q = query.trim();
  const lower = q.toLowerCase();
  const matches: CodeMatch[] = [];

  for (const vs of SPEC.valueSets) {
    for (const inc of vs.includes) {
      for (const c of inc.concepts) {
        if (c.code.toLowerCase() === lower) {
          matches.push({ code: c.code, display: c.display, owner: vs.name, ownerKind: 'valueSet', system: inc.system });
        }
      }
    }
  }
  for (const cs of SPEC.codeSystems) {
    for (const c of cs.concepts) {
      if (c.code.toLowerCase() === lower) {
        matches.push({ code: c.code, display: c.display, owner: cs.name, ownerKind: 'codeSystem', system: cs.url });
      }
    }
  }

  // Find the value sets that enumerate this code (case-insensitive resolve).
  const exactCode = matches.find((m) => m.ownerKind === 'valueSet')?.code ?? q;
  const vsNames = valueSetsByCode.get(exactCode) ?? valueSetsByCode.get(q) ?? new Set<string>();

  const bindings: BindingUse[] = [];
  const steps: EmittingStep[] = [];
  for (const vs of vsNames) {
    bindings.push(...(bindingsByValueSet.get(vs) ?? []));
    steps.push(...(stepsByValueSet.get(vs) ?? []));
  }

  return { query: q, matches, bindings, steps };
}
