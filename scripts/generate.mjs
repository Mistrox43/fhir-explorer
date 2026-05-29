// Generates src/generated/seris.ts from the vendored FHIR package in
// spec/ca.on.oh-seris. Run with: npm run generate
//
// The IG profiles are differential-only constraints (derivation = constraint),
// so we render exactly what SERIS adds on top of base FHIR R4.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = join(__dirname, '..', 'spec', 'ca.on.oh-seris');
const OUT_FILE = join(__dirname, '..', 'src', 'generated', 'seris.ts');

const GUIDE_URL =
  'https://simplifier.net/guide/ca-on-seris-r4-iguide/Table-of-Contents/Home?version=1.1.0';
const GUIDE_VERSION = '1.1.0';

/** Load every JSON resource in the package directory. */
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

/** Strip a trailing |version from a canonical URL. */
const bare = (url) => (url ? String(url).split('|')[0] : url);

// Map canonical URL -> { name, kind, type } for resolving references/bindings.
const byUrl = new Map();
for (const r of resources) {
  if (r.url) byUrl.set(bare(r.url), { name: r.name, kind: r.resourceType, type: r.type });
}
/** Resolve a canonical URL to a known resource name, or its last path segment. */
function resolveName(url) {
  const b = bare(url);
  const hit = byUrl.get(b);
  return hit ? hit.name : b ? b.split('/').pop() : undefined;
}

/** Parse an element's type[] into our ElementType[] shape. */
function parseTypes(el) {
  if (!el.type) return [];
  return el.type.map((t) => {
    const out = { code: t.code };
    if (t.targetProfile?.length) {
      out.targets = t.targetProfile.map(resolveName).filter(Boolean);
    }
    if (t.code === 'Extension' && t.profile?.length) {
      out.extensionProfile = resolveName(t.profile[0]);
    }
    return out;
  });
}

/** Find a fixed[x] / pattern[x] constraint on an element. */
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

/** Convert a StructureDefinition differential into ProfileElement[]. */
function parseElements(sd) {
  const els = sd.differential?.element ?? [];
  const out = [];
  for (const el of els) {
    if (!el.id || !el.id.includes('.')) continue; // skip the root element
    const segs = el.id.split('.').slice(1); // drop the resource/Extension root
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
      types: parseTypes(el),
      binding: parseBinding(el),
      fixed: parseFixed(el),
      short: el.short || undefined,
      definition: el.definition || undefined,
    });
  }
  return out;
}

const allSD = resources.filter((r) => r.resourceType === 'StructureDefinition');
const profileSDs = allSD.filter((r) => r.kind === 'resource' && r.derivation === 'constraint');
const extensionSDs = allSD.filter((r) => r.type === 'Extension');

// ---- Profiles ----
const profileUrls = new Set(profileSDs.map((sd) => bare(sd.url)));
const profileNameByUrl = new Map(profileSDs.map((sd) => [bare(sd.url), sd.name]));

const referenceEdges = [];

const profiles = profileSDs
  .map((sd) => {
    const elements = parseElements(sd);
    const referenced = new Set();
    const usedExtensions = new Set();
    for (const el of elements) {
      for (const t of el.types) {
        if (t.targets) {
          for (const tg of t.targets) {
            // Only graph references that resolve to another SERIS profile.
            if ([...profileNameByUrl.values()].includes(tg) && tg !== sd.name) {
              referenced.add(tg);
              referenceEdges.push({ from: sd.name, to: tg, via: el.id });
            }
          }
        }
        if (t.extensionProfile) usedExtensions.add(t.extensionProfile);
      }
    }
    return {
      name: sd.name,
      baseType: sd.type,
      url: bare(sd.url),
      description: sd.description || undefined,
      elements,
      referencedProfiles: [...referenced].sort(),
      usedExtensions: [...usedExtensions].sort(),
      template: buildTemplate(sd, elements),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/** Build a minimal starter instance from required / must-support top-level elements. */
function buildTemplate(sd, elements) {
  const json = { resourceType: sd.type, meta: { profile: [bare(sd.url)] } };
  const annotations = [];
  const seen = new Set();
  for (const el of elements) {
    if (el.depth !== 1) continue;
    if (el.leaf.includes(':')) continue; // skip slices to keep the skeleton clean
    if (el.leaf.startsWith('extension') || el.leaf.startsWith('modifierExtension')) continue;
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

/** A placeholder value for a template element, based on its first type. */
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
    default:
      return el.max === '*' ? [`<${code ?? 'value'}>`] : `<${code ?? 'value'}>`;
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

console.log(
  `Generated ${OUT_FILE}\n  profiles: ${profiles.length}\n  extensions: ${extensions.length}\n  valueSets: ${valueSets.length}\n  codeSystems: ${codeSystems.length}\n  capabilityStatements: ${capabilityStatements.length}\n  referenceEdges: ${referenceEdges.length}`,
);
