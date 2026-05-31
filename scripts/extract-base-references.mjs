// One-off helper: derives, from base FHIR R4, two vendored files.
//   - spec/base-references.json — each SERIS-constrained resource's Reference
//     elements + their target resource types (so the relationship graph can
//     include references the IG inherits but doesn't restate).
//   - spec/element-shapes.json  — a map { typeOrPath: { childName: childType } }
//     for the 15 base resources (incl. backbone substructure) AND every complex
//     datatype, so the validator can walk a pasted instance and flag unknown /
//     misspelled elements at ANY depth (e.g. meta.sec -> meta.security).
//
// Usage (requires the core package extracted at .tmp-core/package):
//   1. curl -L https://packages.simplifier.net/hl7.fhir.r4.core/4.0.1 -o core.tgz
//   2. mkdir .tmp-core && tar -xzf core.tgz -C .tmp-core
//   3. node scripts/extract-base-references.mjs
//
// The outputs are committed; only re-run when the base resource types change.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = join(__dirname, '..', '.tmp-core', 'package');
const REFS_OUT = join(__dirname, '..', 'spec', 'base-references.json');
const SHAPES_OUT = join(__dirname, '..', 'spec', 'element-shapes.json');

const BASE_TYPES = [
  'Patient', 'Practitioner', 'PractitionerRole', 'Organization', 'Location',
  'Appointment', 'Schedule', 'Slot', 'Encounter', 'Procedure', 'Observation',
  'MedicationAdministration', 'Task', 'MessageHeader', 'Bundle',
];
const BASE_SET = new Set(BASE_TYPES);

if (!existsSync(CORE_DIR)) {
  console.error(`Core package not found at ${CORE_DIR}. See the header of this script.`);
  process.exit(1);
}

// ---- base references (15 resources) ----
const refs = {};
for (const type of BASE_TYPES) {
  const file = join(CORE_DIR, `StructureDefinition-${type}.json`);
  if (!existsSync(file)) {
    console.warn(`missing base SD for ${type}`);
    continue;
  }
  const sd = JSON.parse(readFileSync(file, 'utf-8'));
  const list = [];
  for (const el of sd.snapshot?.element ?? []) {
    for (const t of el.type ?? []) {
      if (t.code !== 'Reference') continue;
      const targets = (t.targetProfile ?? []).map((p) => p.split('/').pop()).filter((x) => x && x !== 'Resource');
      if (targets.length === 0) continue;
      const path = el.path.startsWith(`${type}.`) ? el.path.slice(type.length + 1) : el.path;
      list.push({ path, targets });
    }
  }
  refs[type] = list;
}

// ---- element shapes (15 resources + all complex datatypes) ----
// shapes[key] = { childName: childTypeCode }. key is a resource element path
// ("Bundle", "Bundle.entry") or a datatype name ("Meta", "Coding").
const shapes = {};
const sdFiles = readdirSync(CORE_DIR).filter((f) => f.startsWith('StructureDefinition-') && f.endsWith('.json'));
for (const f of sdFiles) {
  let sd;
  try {
    sd = JSON.parse(readFileSync(join(CORE_DIR, f), 'utf-8'));
  } catch {
    continue;
  }
  if (sd.resourceType !== 'StructureDefinition') continue;
  const include = sd.kind === 'complex-type' || (sd.kind === 'resource' && BASE_SET.has(sd.type));
  if (!include) continue;
  for (const el of sd.snapshot?.element ?? []) {
    const dot = el.path.lastIndexOf('.');
    if (dot < 0) continue; // the root element itself
    const parent = el.path.slice(0, dot);
    const child = el.path.slice(dot + 1);
    const typeCode = el.type?.[0]?.code ?? (el.contentReference ? 'BackboneElement' : '?');
    (shapes[parent] ??= {})[child] = typeCode;
  }
}

writeFileSync(REFS_OUT, `${JSON.stringify(refs, null, 2)}\n`);
writeFileSync(SHAPES_OUT, `${JSON.stringify(shapes, null, 2)}\n`);
const refTotal = Object.values(refs).reduce((n, r) => n + r.length, 0);
console.log(
  `Wrote ${REFS_OUT} (${refTotal} reference elements)\nWrote ${SHAPES_OUT} (${Object.keys(shapes).length} shape keys)`,
);
