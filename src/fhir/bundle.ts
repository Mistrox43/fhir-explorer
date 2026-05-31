// Inspects a SERIS message Bundle: asserts the message envelope, decodes the
// triggering event, validates every entry with the single-resource checker, and
// resolves intra-bundle references (MessageHeader -> focus -> Task -> case
// resources). Composes validateResource() — the same engine the UI exposes.

import { validateResource } from './validate';
import type { Finding, ValidationResult } from './validate';
import { codeSystemByName, profileByName } from './spec';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const EVENT_USECASE: Record<string, string> = {
  'case-scheduled': 'Book elective surgery (OR Case · UC1)',
  'case-performed': 'Record / add-on performed case (OR Case · UC3 / UC6)',
  'case-cancelled': 'Cancel elective / add-on case (OR Case · UC5 / UC7)',
};

export interface InspectedEntry {
  index: number;
  fullUrl?: string;
  resourceType?: string;
  profileName?: string;
  validation: ValidationResult;
}

export interface BundleReport {
  isBundle: boolean;
  structural: Finding[];
  event?: { code?: string; display?: string; meaning?: string; useCase?: string; focus: string[] };
  entries: InspectedEntry[];
  /** Intra-bundle references that don't resolve to an entry. */
  danglingRefs: { from: string; reference: string }[];
  counts: { error: number; warning: number; entries: number };
}

export function inspectBundle(input: unknown): BundleReport {
  const structural: Finding[] = [];
  const add = (severity: Finding['severity'], code: string, path: string, message: string, provenance: Finding['provenance'] = 'seris') =>
    structural.push({ severity, code, path, message, provenance });

  if (!isObj(input) || input.resourceType !== 'Bundle') {
    add('error', 'message-not-bundle', '(root)', 'Not a Bundle resource.');
    return { isBundle: false, structural, entries: [], danglingRefs: [], counts: { error: 1, warning: 0, entries: 0 } };
  }

  // Bundle-level profile checks (type fixed = message, meta.tag, identifier…).
  const bundleVal = validateResource(input);
  structural.push(...bundleVal.findings.filter((f) => f.severity === 'error' || f.severity === 'warning'));

  if (input.type !== 'message') {
    add('error', 'message-type', 'Bundle.type', `Expected a message Bundle (type = "message"), found "${String(input.type)}".`);
  }

  const rawEntries = Array.isArray(input.entry) ? input.entry : [];
  const fullUrls = new Set<string>();
  for (const e of rawEntries) if (isObj(e) && typeof e.fullUrl === 'string') fullUrls.add(e.fullUrl);

  // First entry must be a MessageHeader.
  const first = rawEntries[0];
  const firstRes = isObj(first) ? (first.resource as Obj | undefined) : undefined;
  if (!firstRes || firstRes.resourceType !== 'MessageHeader') {
    add('error', 'message-no-header', 'Bundle.entry[0]', 'A message Bundle must lead with a MessageHeader resource.');
  }

  // Decode the event.
  let event: BundleReport['event'];
  if (firstRes && firstRes.resourceType === 'MessageHeader') {
    const ev = firstRes.eventCoding;
    const code = isObj(ev) ? (ev.code as string) : undefined;
    const display = isObj(ev) ? (ev.display as string) : undefined;
    const cs = codeSystemByName.get('MessageEventCode');
    const meaning = code ? cs?.concepts.find((c) => c.code === code)?.definition : undefined;
    const focus = collectReferences(firstRes.focus).map((r) => r.reference);
    event = { code, display, meaning, useCase: code ? EVENT_USECASE[code] : undefined, focus };
  }

  // Validate each entry + resolve intra-bundle references.
  const entries: InspectedEntry[] = [];
  const danglingRefs: BundleReport['danglingRefs'] = [];
  let errorCount = structural.filter((f) => f.severity === 'error').length;
  let warnCount = structural.filter((f) => f.severity === 'warning').length;

  rawEntries.forEach((e, i) => {
    if (!isObj(e)) return;
    const res = isObj(e.resource) ? (e.resource as Obj) : undefined;
    const resourceType = res ? (res.resourceType as string) : undefined;
    const profileName = res ? resolveProfile(res) : undefined;
    const validation = res ? validateResource(res) : emptyResult();
    errorCount += validation.counts.error;
    warnCount += validation.counts.warning;
    entries.push({
      index: i,
      fullUrl: typeof e.fullUrl === 'string' ? e.fullUrl : undefined,
      resourceType,
      profileName,
      validation,
    });

    // Intra-bundle reference integrity (literal references only).
    if (res) {
      for (const r of collectReferences(res)) {
        if (isIntraBundle(r.reference) && !fullUrls.has(r.reference)) {
          danglingRefs.push({ from: `${resourceType ?? 'entry'}[${i}].${r.path}`, reference: r.reference });
        }
      }
    }
  });

  // MessageHeader.focus must resolve to an entry.
  if (event) {
    for (const f of event.focus) {
      if (isIntraBundle(f) && !fullUrls.has(f)) {
        danglingRefs.push({ from: 'MessageHeader.focus', reference: f });
      }
    }
  }

  return {
    isBundle: true,
    structural,
    event,
    entries,
    danglingRefs,
    counts: { error: errorCount, warning: warnCount, entries: entries.length },
  };
}

function resolveProfile(res: Obj): string | undefined {
  const meta = res.meta;
  const urls = isObj(meta) && Array.isArray(meta.profile) ? (meta.profile as string[]) : [];
  for (const url of urls) {
    const bare = url.split('|')[0];
    const hit = [...profileByName.values()].find((p) => p.url === bare);
    if (hit) return hit.name;
  }
  // fall back to base type
  const byType = [...profileByName.values()].find((p) => p.baseType === res.resourceType);
  return byType?.name;
}

function collectReferences(node: unknown, path = '', out: { path: string; reference: string }[] = []) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectReferences(n, `${path}[${i}]`, out));
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'reference' && typeof v === 'string') out.push({ path: path ? `${path}.reference` : 'reference', reference: v });
      else collectReferences(v, path ? `${path}.${k}` : k, out);
    }
  }
  return out;
}

function isIntraBundle(ref: string): boolean {
  return ref.startsWith('urn:uuid:') || ref.startsWith('urn:');
}

function emptyResult(): ValidationResult {
  return { ok: false, matchedBy: 'none', findings: [], counts: { error: 0, warning: 0, info: 0, pass: 0 } };
}
