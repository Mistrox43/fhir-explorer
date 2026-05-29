# SERIS Explorer

An intuitive, interactive guide to the **Ontario SERIS** (Surgical Efficiency Reporting
Information System) **HL7® FHIR® R4 Implementation Guide**. The official IG on
[Simplifier](https://simplifier.net/guide/ca-on-seris-r4-iguide) is comprehensive but dense;
this tool makes its profiles, extensions, and terminology approachable for implementers who
are learning the spec.

The content is **generated directly from the published FHIR package** (`ca.on.oh-seris`), so
it stays faithful to the spec and can be regenerated whenever the IG is updated.

## Features

- **Explorer** — Browse the 15 resource profiles and drill into each constrained element:
  cardinality, **must-support** (`S`), data type(s), value-set bindings, fixed/pattern values,
  and slicing. Reference elements and extensions link straight to their definitions.
- **Relationships** — A radial diagram of how each profile references (and is referenced by)
  the others. Solid edges are references the IG explicitly constrains; dashed edges are
  inherited from base FHIR R4 (recovered from `spec/base-references.json`). Click a node to
  navigate.
- **Extensions on a profile** — Each profile lists the extensions that target it, derived from
  every extension's declared `context` (including element-level contexts like
  `Slot.blockReleaseRequest`).
- **Template** — A generated minimal starter instance for each profile, showing its required
  and must-support top-level elements with annotations.
- **Extensions** — All ~47 SERIS/SETP extensions, their contexts, and their value types.
- **Terminology** — Browse the 22 value sets and 16 code systems with their concepts.
- **Capabilities** — The IG's CapabilityStatements and their REST interactions.

## How the data is built

The IG's FHIR package is vendored into [`spec/ca.on.oh-seris/`](spec/ca.on.oh-seris). A
generator reads the StructureDefinitions, ValueSets, CodeSystems, and CapabilityStatements and
emits a single typed module:

```bash
npm run generate   # spec/ca.on.oh-seris/*.json  ->  src/generated/seris.ts
```

The profiles are differential-only `constraint` definitions, so the Explorer shows exactly
what SERIS adds on top of base FHIR R4. To update to a newer IG release, replace the package
files in `spec/` and re-run `npm run generate`.

Because the IG rarely restates inherited references, the relationship graph is completed with
[`spec/base-references.json`](spec/base-references.json) — the Reference structure of the 15
base resource types, derived once from `hl7.fhir.r4.core` by
[`scripts/extract-base-references.mjs`](scripts/extract-base-references.mjs).

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- No runtime UI dependencies — the relationship graph is hand-drawn SVG, styling is plain CSS
  with light/dark support.

## Getting started

```bash
npm install
npm run generate   # build the data module from the vendored package
npm run dev        # http://localhost:5183
npm run build      # type-check and build for production
npm run lint
```

## Project structure

```
spec/ca.on.oh-seris/   # vendored FHIR package (the source of truth)
scripts/generate.mjs   # transforms the package into the typed data module
src/
  generated/seris.ts   # AUTO-GENERATED data (do not edit by hand)
  fhir/
    types.ts           # the data-model types
    spec.ts            # loads SPEC and provides lookups
  components/
    ResourceList.tsx       # filterable sidebar grouped by artifact kind
    ElementTree.tsx        # expandable differential element list
    RelationshipGraph.tsx  # radial SVG reference diagram
    ExampleViewer.tsx      # generated template instances
    TerminologyView.tsx    # value sets & code systems
    CapabilityView.tsx     # capability statements
  App.tsx
```

## Version & disclaimer

Built from package `ca.on.oh-seris` **0.11.0-alpha1.0.5** (the latest build on the public
Simplifier registry; the IG's final v1.1.0 package is not published publicly). This is a
**learning aid**, not a conformance or validation tool — always refer to the
[official SERIS Implementation Guide](https://simplifier.net/guide/ca-on-seris-r4-iguide) and
[eHealth Ontario](https://ehealthontario.on.ca/en/standards/ontario-surgical-efficiency-reporting-information-system-hl7-fhir-implementation-guide)
for authoritative details.

FHIR® is a registered trademark of HL7. SERIS and its artifacts are © Ontario Health.
