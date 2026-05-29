# FHIR Explorer

An intuitive, interactive guide to the **[FHIR R4](https://hl7.org/fhir/R4/)** specification.
The official FHIR spec is comprehensive but dense — this tool is meant to make the core
concepts (resources, elements, cardinality, codings, and references) approachable for
people who are learning FHIR.

## Features

- **Explorer** — Browse FHIR resources and drill into each element. Every field shows its
  cardinality (`0..1`, `1..*`, …), data type(s), whether it's a *modifier* or *summary*
  element, and any value-set binding. Reference elements link straight to the resources
  they point at.
- **Relationships** — A radial diagram centred on the selected resource, showing what it
  references (outgoing) and what references it (incoming). Click any node to navigate.
- **Examples** — Worked example payloads with plain-language annotations tying each part of
  the JSON back to what it means.

All content is driven by a curated data model, so adding resources or new FHIR versions is
just a matter of extending the dataset — the UI adapts automatically.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for dev server and bundling
- No runtime UI dependencies — the relationship graph is hand-drawn SVG and the styling is
  plain CSS with light/dark support.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5183)
npm run build    # type-check and build for production
npm run preview  # preview the production build
npm run lint     # run ESLint
```

## Project structure

```
src/
  fhir/
    types.ts        # the type model for the curated spec data
    data.ts         # curated FHIR R4 resources, examples, and reference edges
  components/
    ResourceList.tsx       # sidebar, resources grouped by category
    ElementTree.tsx        # expandable element list (the Explorer view)
    RelationshipGraph.tsx  # radial SVG reference diagram
    ExampleViewer.tsx      # annotated example payloads
  App.tsx           # layout, resource selection, and view tabs
```

## Adding a resource

Append a `FhirResource` to the `RESOURCES` array in [`src/fhir/data.ts`](src/fhir/data.ts).
Give it elements (with `references` for `Reference`-typed fields) and at least one annotated
example. The sidebar, explorer, relationship graph, and examples all update from that data.

## Scope & disclaimer

This is a **learning aid**, not a conformance tool. It covers a hand-picked subset of FHIR
R4 resources and elements chosen to illustrate the concepts clearly — it is not a complete
or authoritative copy of the specification. Always refer to the
[official HL7 FHIR specification](https://hl7.org/fhir/R4/) for definitive details.

FHIR® is a registered trademark of HL7.
