// One-off helper: derives, from base FHIR R4, two vendored files for the
// resource types the SERIS profiles constrain:
//   - spec/base-references.json — each type's Reference elements + their target
//     resource types (so the relationship graph can include inherited refs).
//   - spec/base-elements.json   — each type's top-level element NAMES (so the
//     validator can flag unknown/misspelled top-level elements, did-you-mean).
//
// Usage (requires the core package extracted at .tmp-core/package):
//   1. curl -L https://packages.simplifier.net/hl7.fhir.r4.core/4.0.1 -o core.tgz
//   2. mkdir .tmp-core && tar -xzf core.tgz -C .tmp-core
//   3. node scripts/extract-base-references.mjs
//
// The outputs are small and committed; only re-run if the base resource types change.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = join(__dirname, '..', '.tmp-core', 'package');
const OUT_FILE = join(__dirname, '..', 'spec', 'base-references.json');
const ELEMENTS_OUT = join(__dirname, '..', 'spec', 'base-elements.json');

// The base resource types the SERIS IG profiles constrain.
const BASE_TYPES = [
  'Patient',
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Location',
  'Appointment',
  'Schedule',
  'Slot',
  'Encounter',
  'Procedure',
  'Observation',
  'MedicationAdministration',
  'Task',
  'MessageHeader',
  'Bundle',
];

if (!existsSync(CORE_DIR)) {
  console.error(`Core package not found at ${CORE_DIR}. See the header of this script.`);
  process.exit(1);
}

const out = {};
const elements = {};
for (const type of BASE_TYPES) {
  const file = join(CORE_DIR, `StructureDefinition-${type}.json`);
  if (!existsSync(file)) {
    console.warn(`missing base SD for ${type}`);
    continue;
  }
  const sd = JSON.parse(readFileSync(file, 'utf-8'));
  const els = sd.snapshot?.element ?? [];
  const refs = [];
  const topLevel = new Set();
  for (const el of els) {
    // Top-level element names: "<Type>.<name>" with no further dots. Keep the
    // "[x]" marker on choice elements (e.g. deceased[x]) so the validator can
    // accept the concrete instance keys (deceasedBoolean, deceasedDateTime).
    if (el.path.startsWith(`${type}.`)) {
      const rest = el.path.slice(type.length + 1);
      if (!rest.includes('.')) topLevel.add(rest);
    }
    for (const t of el.type ?? []) {
      if (t.code !== 'Reference') continue;
      const targets = (t.targetProfile ?? [])
        .map((p) => p.split('/').pop())
        .filter((x) => x && x !== 'Resource');
      if (targets.length === 0) continue;
      const path = el.path.startsWith(`${type}.`) ? el.path.slice(type.length + 1) : el.path;
      refs.push({ path, targets });
    }
  }
  out[type] = refs;
  elements[type] = [...topLevel].sort();
}

writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
writeFileSync(ELEMENTS_OUT, `${JSON.stringify(elements, null, 2)}\n`);
const total = Object.values(out).reduce((n, r) => n + r.length, 0);
const elTotal = Object.values(elements).reduce((n, r) => n + r.length, 0);
console.log(
  `Wrote ${OUT_FILE} (${total} reference elements)\nWrote ${ELEMENTS_OUT} (${elTotal} top-level element names across ${Object.keys(elements).length} types)`,
);
