// One-off helper: derives spec/base-references.json — the Reference elements
// (and their target resource types) of the base FHIR R4 resources that the
// SERIS profiles constrain. The SERIS package only restates a handful of
// references in its differentials; the rest are inherited from base FHIR R4,
// so the relationship graph needs this to be complete.
//
// Usage (requires the core package extracted at .tmp-core/package):
//   1. curl -L https://packages.simplifier.net/hl7.fhir.r4.core/4.0.1 -o core.tgz
//   2. mkdir .tmp-core && tar -xzf core.tgz -C .tmp-core
//   3. node scripts/extract-base-references.mjs
//
// The output is small and committed; you only need to re-run this if the set
// of base resource types changes.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = join(__dirname, '..', '.tmp-core', 'package');
const OUT_FILE = join(__dirname, '..', 'spec', 'base-references.json');

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
for (const type of BASE_TYPES) {
  const file = join(CORE_DIR, `StructureDefinition-${type}.json`);
  if (!existsSync(file)) {
    console.warn(`missing base SD for ${type}`);
    continue;
  }
  const sd = JSON.parse(readFileSync(file, 'utf-8'));
  const elements = sd.snapshot?.element ?? [];
  const refs = [];
  for (const el of elements) {
    for (const t of el.type ?? []) {
      if (t.code !== 'Reference') continue;
      const targets = (t.targetProfile ?? [])
        .map((p) => p.split('/').pop())
        .filter((x) => x && x !== 'Resource');
      if (targets.length === 0) continue;
      // Path relative to the resource root, e.g. "participant.actor".
      const path = el.path.startsWith(`${type}.`) ? el.path.slice(type.length + 1) : el.path;
      refs.push({ path, targets });
    }
  }
  out[type] = refs;
}

writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
const total = Object.values(out).reduce((n, r) => n + r.length, 0);
console.log(`Wrote ${OUT_FILE}\n  types: ${Object.keys(out).length}\n  reference elements: ${total}`);
