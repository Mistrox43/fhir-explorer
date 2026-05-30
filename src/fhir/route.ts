import type { ArtifactKind, Selection } from './spec';

// Serializes the app's view into the URL hash so a refresh restores it and a
// link can be shared to an exact profile / element / code. State carried:
// mode + selection(kind,name) + tab + an optional anchor (element id or code).

export type AppMode = 'orientation' | 'reference' | 'validate';

export interface AppRoute {
  mode: AppMode;
  selection?: Selection;
  tab?: string;
  anchor?: string;
}

const KINDS: ArtifactKind[] = ['profile', 'extension', 'valueSet', 'codeSystem', 'capability'];
const MODES: AppMode[] = ['orientation', 'reference', 'validate'];

export function encodeRoute(r: AppRoute): string {
  const p = new URLSearchParams();
  p.set('mode', r.mode);
  if (r.selection) {
    p.set('kind', r.selection.kind);
    p.set('name', r.selection.name);
  }
  if (r.tab) p.set('tab', r.tab);
  if (r.anchor) p.set('at', r.anchor);
  return p.toString();
}

export function parseRoute(hash: string): Partial<AppRoute> {
  const h = hash.replace(/^#/, '');
  if (!h) return {};
  const p = new URLSearchParams(h);
  const out: Partial<AppRoute> = {};

  const mode = p.get('mode');
  if (mode && (MODES as string[]).includes(mode)) out.mode = mode as AppMode;

  const kind = p.get('kind');
  const name = p.get('name');
  if (kind && name && (KINDS as string[]).includes(kind)) {
    out.selection = { kind: kind as ArtifactKind, name };
  }

  const tab = p.get('tab');
  if (tab) out.tab = tab;
  const at = p.get('at');
  if (at) out.anchor = at;
  return out;
}
