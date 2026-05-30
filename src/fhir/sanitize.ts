// Cleans the IG element `comment` field, which ships SERIS implementer guidance
// wrapped in decorative markdown noise, e.g.:
//   #### **_` FOR SERIS USAGE: The meta.profile = http://.../Appointment|1.0.1 `_**\r\n\r\n
//   It is up to the server ... The list of profile URLs is a set.
// We split that into the high-value SERIS guidance and the base-FHIR text.

export interface ParsedComment {
  /** The SERIS-specific implementer guidance (de-noised), if present. */
  seris?: string;
  /** The remaining base-FHIR description, if any. */
  base?: string;
}

const SERIS_SPAN = /`([^`]*?FOR SERIS USAGE[^`]*?)`/i;

/** Parse an IG comment into SERIS guidance + base text. */
export function parseComment(raw?: string): ParsedComment | undefined {
  if (!raw) return undefined;
  let s = raw.replace(/\r\n?/g, '\n').replace(/^"+|"+$/g, '').trim();

  let seris: string | undefined;
  const m = s.match(SERIS_SPAN);
  if (m) {
    seris = m[1].replace(/^\s*FOR SERIS USAGE:?\s*/i, '').trim() || undefined;
    // Remove the whole decorative wrapper (#### **_ `...` _**) to leave base text.
    s = s.replace(/#{0,6}\s*\*{0,2}_?\s*`[^`]*?FOR SERIS USAGE[^`]*?`\s*_?\*{0,2}/i, '').trim();
  }

  const base = stripMarkdown(s) || undefined;
  if (!seris && !base) return undefined;
  return { seris, base };
}

/** Flatten a comment to a single plain-text string (for search indexing). */
export function sanitizeComment(raw?: string): string | undefined {
  const p = parseComment(raw);
  if (!p) return undefined;
  return [p.seris, p.base].filter(Boolean).join(' — ') || undefined;
}

function stripMarkdown(t: string): string {
  return t
    .replace(/[`_*]+/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\.+/, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
