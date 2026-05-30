# SERIS Explorer

An intuitive, interactive guide to the **Ontario SERIS** (Surgical Efficiency Reporting
Information System) **HL7® FHIR® R4 Implementation Guide**. The official IG on
[Simplifier](https://simplifier.net/guide/ca-on-seris-r4-iguide) is comprehensive but dense;
this tool makes its profiles, extensions, and terminology approachable for implementers who
are learning the spec.

The content is **generated directly from the published FHIR package** (`ca.on.oh-seris`), so
it stays faithful to the spec and can be regenerated whenever the IG is updated.

The app has two modes: **Orientation** (a guided, business-first walkthrough) and **Reference**
(the full artifact browser). It opens in Orientation by default.

## Features

- **Orientation** — A guided walkthrough grounded in the IG's surgical business workflow. It
  opens on a curated **Key Journey** (open an OR → schedule → block → book → perform → cancel →
  report) and offers two full tracks — **OR Schedule** (16 use cases) and **OR Case** (8 use
  cases, modelled as `Encounter` state transitions). Each business event shows the FHIR artifacts
  it produces (clickable chips that jump into the Reference explorer), an illustrative example
  payload, and the relevant profile's generated template. Business descriptions are summarised
  from the IG's [Business Context · Use Cases](https://simplifier.net/guide/ca-on-seris-r4-iguide/Table-of-Contents/BusinessContext/Use-Cases?version=1.1.0)
  page; every artifact link is validated against the loaded package data.
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

### Onboarding & developer tools (all client-side, no backend)

- **Validate** — Paste a FHIR resource (or Bundle) and check it against its SERIS profile:
  required/cardinality/fixed-value/value-set-binding/must-support, with plain-language
  PASS/ERROR/WARN findings. It is a *structural SERIS-profile* check (not full FHIR R4) and is
  explicit, per finding, about what it can't see. Nothing is uploaded. Every example and template
  has a **"Validate this"** button that runs it inline.
- **Search (⌘/Ctrl-K)** — A command palette over the whole IG: profiles, every element, extensions,
  value sets, code systems, and all ~1,540 enumerated concepts. Enter jumps straight to the artifact
  (and scrolls/flashes the exact element or code).
- **Code decoder** — Pick a code in search (or type one) to get its meaning, the value set + code
  system it lives in, every profile element that binds it, and the business events that emit it —
  the reverse "where is this used" lookup support teams need.
- **Build & Review checklist** — A per-profile tab listing just the required + must-support elements
  (with bindings, fixed values, and cleaned SERIS guidance) and a "copy as list" for tickets/specs.
- **Copy / download + shareable deep links** — Copy or download any JSON payload (downloads and
  shared links are stamped with the IG package version); the URL hash encodes mode + artifact + tab
  + element/code, so a refresh restores the exact view and links are shareable.

### Advanced tools

- **Build** — Assemble a ready-to-send SERIS message Bundle for a case event (scheduled / performed /
  cancelled). The envelope is locked conformant (`type = "message"`, leading MessageHeader with the
  fixed event system, a Task with `businessStatus`, `urn:uuid` fullUrls, wired focus, facility tag);
  the case resource is seeded from the validated example. Includes a value-set **code picker**.
- **Bundle Inspector** — Paste a whole message Bundle into Validate and it resolves the
  MessageHeader → focus → Task → case structure, decodes the event (+ originating use case), validates
  every entry with the same checker, flags unresolved references, and deep-links each entry.
- **Scenario Player & Lifecycle** — Walk a case end-to-end (booked → performed / cancelled) with a
  running state, plus an interactive Encounter business-status state-machine diagram.
- **Troubleshooting playbooks** — Symptom → cause → fix entries, surfaced as "how to fix" on matching
  findings and as a browsable list; transport/auth issues are flagged out-of-scope.
- **Connectivity guide** — The CapabilityStatement view explains the create-only, message-Bundle-over-
  REST contract with copy-paste curl / Postman / JSON skeletons and a minimal valid envelope.

### Privacy, offline & trust

- **PHIPA / privacy** — The validator runs entirely in the browser; nothing is uploaded, the input
  is cleared when you leave, and shared links **never** contain pasted instance data (only artifact
  selection). A **Redact PHI** button masks names, identifiers, dates, addresses and contact details.
- **Offline** — The app makes no runtime network calls (the whole IG is bundled; fonts are
  system fonts; external links only open on click), so it works fully offline from a static host or
  saved files.
- **Trust** — A test suite ([`src/fhir/validate.test.ts`](src/fhir/validate.test.ts), `npm test`,
  enforced in CI) runs every bundled example through the same conformance checker the UI exposes, so
  the payloads users are told to copy are proven against the spec.

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
