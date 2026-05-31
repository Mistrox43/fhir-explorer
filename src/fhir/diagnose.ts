// Aggregates the raw findings of a validation into a small set of prioritized,
// SPECIFIC, actionable diagnoses — built from the actual paths, suggestions and
// expected values on screen — so a user sees "here are the 3 things wrong and
// exactly how to fix each" rather than a flat list.

import type { Finding } from './validate';
import { matchPlaybook } from './playbooks';
import type { Playbook } from './playbooks';

export interface Diagnosis {
  code: string;
  severity: 'error' | 'warning';
  title: string;
  count: number;
  /** Concrete, data-derived guidance for these findings. */
  advice: string;
  /** Distinct instance paths affected. */
  paths: string[];
  playbook?: Playbook;
}

const TITLES: Record<string, string> = {
  'unknown-resource-type': 'Misspelled resourceType',
  'missing-resource-type': 'Missing resourceType',
  'not-json': 'Not a JSON resource',
  'unknown-element': 'Unknown / misspelled element',
  'reference-identifier-missing': 'Reference missing its identifier',
  'required-missing': 'Missing required element',
  'fixed-mismatch': 'Fixed value mismatch',
  'unbound-code': 'Invalid coded value',
  cardinality: 'Cardinality exceeded',
  'unknown-extension': 'Unknown extension URL',
  'message-not-bundle': 'Not a Bundle',
  'message-type': 'Bundle is not a message',
  'message-no-header': 'No leading MessageHeader',
  'unresolved-reference': 'Unresolved reference',
};

const list = (xs: string[], max = 6) =>
  xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} (+${xs.length - max} more)`;

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

function adviceFor(code: string, fs: Finding[], paths: string[], pb?: Playbook): string {
  switch (code) {
    case 'unknown-resource-type': {
      const sug = fs.find((f) => f.suggestion)?.suggestion;
      return sug ? `Set resourceType to "${sug}".` : fs[0].message;
    }
    case 'unknown-element':
      return `Fix the element name(s): ${list(
        fs.map((f) => (f.suggestion ? `${f.path} → ${f.suggestion}` : f.path)),
      )}.`;
    case 'reference-identifier-missing':
      return `These references need a business identifier: ${list(paths)}. Send each as { "identifier": { "system": …, "value": … } }.`;
    case 'required-missing':
      return `Add the missing required element(s): ${list(paths)}.`;
    case 'fixed-mismatch':
      return `Set the required fixed value(s): ${list(fs.map((f) => `${f.path} = ${f.suggestion ?? '…'}`))}.`;
    case 'unbound-code': {
      const vs = uniq(fs.map((f) => f.suggestion));
      return `Use a code from the bound value set${vs.length ? ` (${list(vs)})` : ''} at: ${list(paths)}.`;
    }
    case 'cardinality':
      return `Reduce repetitions to the allowed maximum at: ${list(paths)}.`;
    case 'unknown-extension':
      return `Unknown extension URL(s) at ${list(paths)} — only IG-defined extensions are recognized.`;
    default:
      return pb?.fix ?? fs[0].message;
  }
}

export function diagnose(findings: Finding[]): Diagnosis[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    if (f.severity !== 'error' && f.severity !== 'warning') continue;
    const arr = groups.get(f.code) ?? [];
    arr.push(f);
    groups.set(f.code, arr);
  }

  const out: Diagnosis[] = [];
  for (const [code, fs] of groups) {
    const severity: 'error' | 'warning' = fs.some((f) => f.severity === 'error') ? 'error' : 'warning';
    const paths = uniq(fs.map((f) => f.path));
    const pb = matchPlaybook(fs[0]);
    out.push({
      code,
      severity,
      count: fs.length,
      paths,
      title: TITLES[code] ?? pb?.title ?? code,
      advice: adviceFor(code, fs, paths, pb),
      playbook: pb,
    });
  }

  // Errors first, then by how many instances.
  out.sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === 'error' ? -1 : 1));
  return out;
}
