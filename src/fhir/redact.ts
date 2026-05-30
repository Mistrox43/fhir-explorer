// Masks personal health information in a pasted FHIR instance so a support
// analyst can paste a real (PHIPA-protected) submission and inspect its
// structure without the identifiers ever being displayed. Runs entirely in the
// browser on the in-memory object; nothing leaves the page.

const MASK = '•••';
const DATE_MASK = '••••-••-••';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function maskString(v: unknown): unknown {
  return typeof v === 'string' ? MASK : v;
}
function maskStringArray(v: unknown): unknown {
  return Array.isArray(v) ? v.map(() => MASK) : v;
}

/** Return a deep copy with PHI fields masked. */
export function redact(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(redact);
  if (!isObj(input)) return input;

  const o: Obj = { ...input };

  // HumanName
  if ('family' in o || 'given' in o) {
    if ('family' in o) o.family = maskString(o.family);
    if ('given' in o) o.given = maskStringArray(o.given);
    if ('text' in o) o.text = maskString(o.text);
    if ('prefix' in o) o.prefix = maskStringArray(o.prefix);
    if ('suffix' in o) o.suffix = maskStringArray(o.suffix);
  }

  // Address
  if ('line' in o || ('city' in o && 'postalCode' in o)) {
    if ('line' in o) o.line = maskStringArray(o.line);
    for (const k of ['text', 'city', 'district', 'state', 'postalCode']) {
      if (k in o) o[k] = maskString(o[k]);
    }
  }

  // Birth date
  if (typeof o.birthDate === 'string') o.birthDate = DATE_MASK;

  // Identifier / ContactPoint value (but NOT Quantity, which has unit/code).
  if (typeof o.value === 'string' && 'system' in o && !('unit' in o) && !('code' in o)) {
    o.value = MASK;
  }

  // Recurse into children.
  for (const k of Object.keys(o)) {
    o[k] = redact(o[k]);
  }
  return o;
}
