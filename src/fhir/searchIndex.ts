import { SPEC } from './spec';
import type { Selection } from './spec';
import { sanitizeComment } from './sanitize';

// A flat, in-memory search index over the whole IG (profiles, every element,
// extensions, value sets, code systems and all enumerated concepts). Built once
// at module load; the existing sidebar filter only matched artifact names.

export type SearchGroup =
  | 'Profile'
  | 'Element'
  | 'Extension'
  | 'Value set'
  | 'Code system'
  | 'Concept'
  | 'Capability';

export interface SearchEntry {
  key: string;
  group: SearchGroup;
  label: string;
  sublabel?: string;
  /** Lowercased searchable text. */
  haystack: string;
  selection: Selection;
  /** Element id or concept code to scroll/flash on open. */
  anchor?: string;
  /** Present for code concepts — enables the decoder. */
  code?: string;
}

function build(): SearchEntry[] {
  const out: SearchEntry[] = [];
  const push = (e: SearchEntry) => out.push(e);

  for (const p of SPEC.profiles) {
    push({
      key: `p:${p.name}`,
      group: 'Profile',
      label: p.name,
      sublabel: `constrains ${p.baseType}`,
      haystack: `${p.name} ${p.baseType} ${p.description ?? ''}`.toLowerCase(),
      selection: { kind: 'profile', name: p.name },
    });
    for (const el of p.elements) {
      push({
        key: `pe:${p.name}:${el.id}`,
        group: 'Element',
        label: el.id,
        sublabel: el.short,
        haystack: `${el.id} ${el.short ?? ''} ${el.definition ?? ''} ${sanitizeComment(el.comment) ?? ''}`.toLowerCase(),
        selection: { kind: 'profile', name: p.name },
        anchor: el.id,
      });
    }
  }

  for (const e of SPEC.extensions) {
    push({
      key: `x:${e.name}`,
      group: 'Extension',
      label: e.name,
      sublabel: e.contexts.join(', '),
      haystack: `${e.name} ${e.description ?? ''} ${e.contexts.join(' ')}`.toLowerCase(),
      selection: { kind: 'extension', name: e.name },
    });
  }

  for (const v of SPEC.valueSets) {
    push({
      key: `vs:${v.name}`,
      group: 'Value set',
      label: v.name,
      sublabel: v.description,
      haystack: `${v.name} ${v.description ?? ''}`.toLowerCase(),
      selection: { kind: 'valueSet', name: v.name },
    });
    for (const inc of v.includes) {
      for (const c of inc.concepts) {
        push({
          key: `vsc:${v.name}:${c.code}`,
          group: 'Concept',
          label: c.code,
          sublabel: `${c.display ?? ''} · ${v.name}`,
          haystack: `${c.code} ${c.display ?? ''} ${v.name}`.toLowerCase(),
          selection: { kind: 'valueSet', name: v.name },
          anchor: c.code,
          code: c.code,
        });
      }
    }
  }

  for (const cs of SPEC.codeSystems) {
    push({
      key: `cs:${cs.name}`,
      group: 'Code system',
      label: cs.name,
      sublabel: cs.description,
      haystack: `${cs.name} ${cs.description ?? ''}`.toLowerCase(),
      selection: { kind: 'codeSystem', name: cs.name },
    });
    for (const c of cs.concepts) {
      push({
        key: `csc:${cs.name}:${c.code}`,
        group: 'Concept',
        label: c.code,
        sublabel: `${c.display ?? ''} · ${cs.name}`,
        haystack: `${c.code} ${c.display ?? ''} ${cs.name} ${c.definition ?? ''}`.toLowerCase(),
        selection: { kind: 'codeSystem', name: cs.name },
        anchor: c.code,
        code: c.code,
      });
    }
  }

  for (const cap of SPEC.capabilityStatements) {
    push({
      key: `cap:${cap.name}`,
      group: 'Capability',
      label: cap.name,
      sublabel: cap.description,
      haystack: `${cap.name} ${cap.description ?? ''}`.toLowerCase(),
      selection: { kind: 'capability', name: cap.name },
    });
  }

  return out;
}

export const SEARCH_INDEX = build();

/** Rank entries against a query. All terms must match (AND); earlier = better. */
export function search(query: string, limit = 40): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of SEARCH_INDEX) {
    let score = 0;
    let ok = true;
    for (const t of terms) {
      const idx = e.haystack.indexOf(t);
      if (idx === -1) {
        ok = false;
        break;
      }
      score += e.label.toLowerCase().startsWith(t) ? 3 : idx === 0 ? 2 : 1;
    }
    if (!ok) continue;
    if (e.label.toLowerCase() === q) score += 6;
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}
