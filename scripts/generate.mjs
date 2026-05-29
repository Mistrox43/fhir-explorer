// Generates src/generated/seris.ts from the vendored FHIR package in
// spec/ca.on.oh-seris. Run with: npm run generate
//
// The IG profiles are differential-only constraints (derivation = constraint),
// so we render exactly what SERIS adds on top of base FHIR R4. References that
// the IG does not restate are recovered from spec/base-references.json (the
// base FHIR R4 reference structure — see scripts/extract-base-references.mjs).

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = join(__dirname, '..', 'spec', 'ca.on.oh-seris');
const BASE_REFS_FILE = join(__dirname, '..', 'spec', 'base-references.json');
const OUT_FILE = join(__dirname, '..', 'src', 'generated', 'seris.ts');

const GUIDE_URL =
  'https://simplifier.net/guide/ca-on-seris-r4-iguide/Table-of-Contents/Home?version=1.1.0';
const GUIDE_VERSION = '1.1.0';

function loadResources() {
  const files = readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json'));
  const resources = [];
  for (const f of files) {
    if (f === 'package.json' || f === '.index.json') continue;
    try {
      resources.push(JSON.parse(readFileSync(join(SPEC_DIR, f), 'utf-8')));
    } catch (e) {
      console.warn(`skip ${f}: ${e.message}`);
    }
  }
  return resources;
}

const pkg = JSON.parse(readFileSync(join(SPEC_DIR, 'package.json'), 'utf-8'));
const resources = loadResources();
const baseRefs = existsSync(BASE_REFS_FILE)
  ? JSON.parse(readFileSync(BASE_REFS_FILE, 'utf-8'))
  : {};
if (!existsSync(BASE_REFS_FILE)) {
  console.warn('spec/base-references.json missing — inherited references will be omitted.');
}

const bare = (url) => (url ? String(url).split('|')[0] : url);

// Map canonical URL -> { name, kind, type } for resolving references/bindings.
const byUrl = new Map();
for (const r of resources) {
  if (r.url) byUrl.set(bare(r.url), { name: r.name, kind: r.resourceType, type: r.type });
}
function resolveName(url) {
  const b = bare(url);
  const hit = byUrl.get(b);
  return hit ? hit.name : b ? b.split('/').pop() : undefined;
}

const allSD = resources.filter((r) => r.resourceType === 'StructureDefinition');
const profileSDs = allSD.filter((r) => r.kind === 'resource' && r.derivation === 'constraint');
const extensionSDs = allSD.filter((r) => r.type === 'Extension');

// Resolvers that tolerate the case/slug inconsistencies in the IG (e.g. a
// targetProfile of ".../ca-on-seris-profile-practitionerrole" must resolve to
// the "PractitionerRole" profile).
const profileByUrl = new Map(profileSDs.map((sd) => [bare(sd.url), sd.name]));
const profileByBaseType = new Map(profileSDs.map((sd) => [sd.type.toLowerCase(), sd.name]));
const profileByLowerName = new Map(profileSDs.map((sd) => [sd.name.toLowerCase(), sd.name]));

/** Resolve a reference targetProfile URL to a SERIS profile name, or null. */
function resolveProfileRef(url) {
  const b = bare(url);
  if (profileByUrl.has(b)) return profileByUrl.get(b);
  const slug = (b.split('/').pop() || '').toLowerCase().replace('ca-on-seris-profile-', '');
  return profileByBaseType.get(slug) ?? profileByLowerName.get(slug) ?? null;
}

function parseTypes(el) {
  if (!el.type) return [];
  return el.type.map((t) => {
    const out = { code: t.code };
    if (t.targetProfile?.length) {
      out.targets = t.targetProfile.map((p) => resolveProfileRef(p) ?? p.split('/').pop());
    }
    if (t.code === 'Extension' && t.profile?.length) {
      out.extensionProfile = resolveName(t.profile[0]);
    }
    return out;
  });
}

function parseFixed(el) {
  for (const k of Object.keys(el)) {
    if (k.startsWith('fixed')) return { kind: 'fixed', type: k.slice(5), value: el[k] };
    if (k.startsWith('pattern')) return { kind: 'pattern', type: k.slice(7), value: el[k] };
  }
  return undefined;
}

function parseBinding(el) {
  if (!el.binding) return undefined;
  const valueSetUrl = bare(el.binding.valueSet);
  return {
    strength: el.binding.strength,
    valueSetUrl,
    valueSetName: valueSetUrl ? resolveName(valueSetUrl) : undefined,
  };
}

function parseSlicing(el) {
  if (!el.slicing) return undefined;
  const discriminator = (el.slicing.discriminator ?? []).map((d) => `${d.type} @ ${d.path}`);
  return { discriminator, rules: el.slicing.rules, ordered: el.slicing.ordered };
}

function parseElements(sd) {
  const els = sd.differential?.element ?? [];
  const out = [];
  for (const el of els) {
    if (!el.id || !el.id.includes('.')) continue; // skip the root element
    const segs = el.id.split('.').slice(1);
    const leaf = segs[segs.length - 1];
    const sliceName = leaf.includes(':') ? leaf.split(':')[1] : undefined;
    out.push({
      id: el.id,
      leaf,
      depth: segs.length,
      sliceName,
      min: el.min ?? null,
      max: el.max ?? null,
      mustSupport: el.mustSupport === true,
      isModifier: el.isModifier === true ? true : undefined,
      types: parseTypes(el),
      binding: parseBinding(el),
      fixed: parseFixed(el),
      slicing: parseSlicing(el),
      short: el.short || undefined,
      definition: el.definition || undefined,
      comment: el.comment || undefined,
    });
  }
  return out;
}

// ---- Extension → profile context map ----
// Each extension declares the resource (or element path) it attaches to.
const extensionUsesByProfile = new Map(profileSDs.map((sd) => [sd.name, []]));
for (const ext of extensionSDs) {
  for (const c of ext.context ?? []) {
    if (!c.expression) continue;
    const root = c.expression.split('.')[0];
    const profileName = profileByBaseType.get(root.toLowerCase());
    if (profileName) {
      extensionUsesByProfile.get(profileName).push({ name: ext.name, context: c.expression });
    }
  }
}

// ---- Reference edges (profiled + inherited) ----
const edgeKey = (e) => `${e.from}|${e.to}`;
const edgeMap = new Map(); // key -> edge (profiled wins over inherited)
function addEdge(from, to, via, kind) {
  if (from === to) return;
  const key = `${from}|${to}`;
  const existing = edgeMap.get(key);
  if (!existing) {
    edgeMap.set(key, { from, to, via, kind });
  } else if (existing.kind === 'inherited' && kind === 'profiled') {
    edgeMap.set(key, { from, to, via, kind });
  }
}

// Profiled edges: references the IG restates in a profile's differential.
for (const sd of profileSDs) {
  for (const el of sd.differential?.element ?? []) {
    for (const t of el.type ?? []) {
      if (t.code !== 'Reference') continue;
      for (const tp of t.targetProfile ?? []) {
        const target = resolveProfileRef(tp);
        if (target) addEdge(sd.name, target, el.id, 'profiled');
      }
    }
  }
}

// Inherited edges: references from base FHIR R4 whose target type has a profile.
for (const sd of profileSDs) {
  const refs = baseRefs[sd.type] ?? [];
  for (const ref of refs) {
    for (const targetType of ref.targets) {
      const target = profileByBaseType.get(targetType.toLowerCase());
      if (target) addEdge(sd.name, target, `${sd.type}.${ref.path}`, 'inherited');
    }
  }
}

const referenceEdges = [...edgeMap.values()];

// ---- Profiles ----
const profiles = profileSDs
  .map((sd) => {
    const elements = parseElements(sd);
    const referenced = new Set(
      referenceEdges.filter((e) => e.from === sd.name).map((e) => e.to),
    );
    return {
      name: sd.name,
      baseType: sd.type,
      url: bare(sd.url),
      description: sd.description || undefined,
      elements,
      referencedProfiles: [...referenced].sort(),
      extensionsOnProfile: (extensionUsesByProfile.get(sd.name) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      template: buildTemplate(sd, elements),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

function buildTemplate(sd, elements) {
  const json = { resourceType: sd.type, meta: { profile: [bare(sd.url)] } };
  const annotations = [];
  const seen = new Set();
  for (const el of elements) {
    if (el.depth !== 1) continue;
    if (el.leaf.includes(':')) continue;
    if (el.leaf.startsWith('extension') || el.leaf.startsWith('modifierExtension')) continue;
    if (el.leaf === 'meta') continue; // meta.profile is already set above
    const required = el.min != null && el.min >= 1;
    if (!required && !el.mustSupport) continue;
    const key = el.leaf.replace(/\[x\]$/, 'Value');
    if (seen.has(key)) continue;
    seen.add(key);
    json[key] = placeholder(el);
    annotations.push({ path: key, note: el.short || el.definition || '' });
  }
  return {
    title: `Minimal ${sd.name}`,
    description:
      'A generated starter skeleton showing the required and must-support top-level elements of this profile. Fill in real values; nested constraints and slices are described in the Explorer tab.',
    json,
    annotations,
  };
}

function placeholder(el) {
  const code = el.types[0]?.code;
  switch (code) {
    case 'boolean':
      return true;
    case 'integer':
    case 'positiveInt':
    case 'unsignedInt':
    case 'decimal':
      return 0;
    case 'date':
      return '2025-01-01';
    case 'dateTime':
    case 'instant':
      return '2025-01-01T09:00:00Z';
    case 'Reference': {
      const t = el.types[0]?.targets?.[0] ?? 'Resource';
      return { reference: `${t}/example` };
    }
    case 'CodeableConcept':
      return { coding: [{ system: '…', code: '…' }] };
    case 'Coding':
      return { system: '…', code: '…' };
    case 'Identifier':
      return { system: '…', value: '…' };
    case 'HumanName':
      return [{ family: '…', given: ['…'] }];
    case 'Period':
      return { start: '2025-01-01T09:00:00Z' };
    case 'Quantity':
      return { value: 0, unit: '…' };
    case 'code':
    case 'string':
    case 'uri':
    case 'canonical':
    case undefined:
      return el.max === '*' ? ['…'] : '…';
    default:
      return el.max === '*' ? [`<${code}>`] : `<${code}>`;
  }
}

// ---- Extensions ----
const extensions = extensionSDs
  .map((sd) => ({
    name: sd.name,
    url: bare(sd.url),
    contexts: (sd.context ?? []).map((c) => c.expression).filter(Boolean),
    description: sd.description || undefined,
    elements: parseElements(sd),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- ValueSets ----
const valueSets = resources
  .filter((r) => r.resourceType === 'ValueSet')
  .map((vs) => {
    const includes = (vs.compose?.include ?? []).map((inc) => ({
      system: bare(inc.system),
      systemName: inc.system ? resolveName(inc.system) : undefined,
      concepts: (inc.concept ?? []).map((c) => ({ code: c.code, display: c.display })),
      filters: (inc.filter ?? []).map((f) => `${f.property} ${f.op} ${f.value}`),
    }));
    return { name: vs.name, url: bare(vs.url), description: vs.description || undefined, includes };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- CodeSystems ----
function flattenConcepts(concepts, out = []) {
  for (const c of concepts ?? []) {
    out.push({ code: c.code, display: c.display, definition: c.definition });
    if (c.concept) flattenConcepts(c.concept, out);
  }
  return out;
}
const codeSystems = resources
  .filter((r) => r.resourceType === 'CodeSystem')
  .map((cs) => ({
    name: cs.name,
    url: bare(cs.url),
    description: cs.description || undefined,
    concepts: flattenConcepts(cs.concept),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- CapabilityStatements ----
const capabilityStatements = resources
  .filter((r) => r.resourceType === 'CapabilityStatement')
  .map((cap) => {
    const rest = (cap.rest ?? [])[0] ?? {};
    return {
      name: cap.name,
      description: cap.description || undefined,
      mode: rest.mode,
      resources: (rest.resource ?? []).map((res) => ({
        type: res.type,
        profile: res.profile ? resolveName(res.profile) : undefined,
        interactions: (res.interaction ?? []).map((i) => i.code),
      })),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- Emit ----
const spec = {
  meta: {
    package: pkg.name,
    packageVersion: pkg.version,
    fhirVersion: (pkg.fhirVersions || ['4.0.1'])[0],
    guideVersion: GUIDE_VERSION,
    guideUrl: GUIDE_URL,
    canonicalBase: 'http://ontariohealth.ca/fhir',
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  profiles,
  extensions,
  valueSets,
  codeSystems,
  capabilityStatements,
  referenceEdges,
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
const banner =
  '// AUTO-GENERATED by scripts/generate.mjs from spec/ca.on.oh-seris.\n' +
  '// Do not edit by hand — run `npm run generate` to refresh.\n';
writeFileSync(
  OUT_FILE,
  `${banner}import type { SerisSpec } from '../fhir/types';\n\nexport const SPEC: SerisSpec = ${JSON.stringify(
    spec,
    null,
    2,
  )};\n`,
);

const profiledEdges = referenceEdges.filter((e) => e.kind === 'profiled').length;
console.log(
  `Generated ${OUT_FILE}\n  profiles: ${profiles.length}\n  extensions: ${extensions.length}\n  valueSets: ${valueSets.length}\n  codeSystems: ${codeSystems.length}\n  capabilityStatements: ${capabilityStatements.length}\n  referenceEdges: ${referenceEdges.length} (${profiledEdges} profiled, ${referenceEdges.length - profiledEdges} inherited)`,
);
