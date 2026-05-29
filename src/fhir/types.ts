// Type model describing the curated slice of the FHIR R4 specification
// that this tool renders. It is intentionally simpler than the full
// StructureDefinition format — just enough to teach the concepts.

/** A value-set binding attached to a coded element. */
export interface ElementBinding {
  /** How strongly the value set is enforced. */
  strength: 'required' | 'extensible' | 'preferred' | 'example';
  /** Human-friendly name of the bound value set. */
  valueSet: string;
}

/** A single element (field) within a FHIR resource. */
export interface FhirElement {
  /** Dotted path, e.g. "Patient.name.family". */
  path: string;
  /** One or more data types this element may hold. */
  type: string[];
  /** Minimum cardinality (0 = optional). */
  min: number;
  /** Maximum cardinality ("1" or "*"). */
  max: string;
  /** Short, one-line summary shown in the tree. */
  short: string;
  /** Longer explanation shown when the element is expanded. */
  definition?: string;
  /** True if changing this element changes the meaning of the resource. */
  isModifier?: boolean;
  /** True if the element appears in summary views. */
  isSummary?: boolean;
  /** Value-set binding, when the element is coded. */
  binding?: ElementBinding;
  /** Target resource types when `type` includes "Reference". */
  references?: string[];
}

/** A note tying a JSON path in an example to a plain-language explanation. */
export interface ExampleAnnotation {
  /** JSON pointer-ish path, e.g. "name[0].family". */
  path: string;
  /** Plain-language explanation of what that part means. */
  note: string;
}

/** A worked example payload with teaching annotations. */
export interface AnnotatedExample {
  title: string;
  description: string;
  /** The example resource as a JSON value. */
  json: unknown;
  annotations: ExampleAnnotation[];
}

/** A curated FHIR resource definition. */
export interface FhirResource {
  /** Resource type name, e.g. "Patient". */
  name: string;
  /** Spec module the resource belongs to. */
  category: 'Foundation' | 'Administrative' | 'Clinical' | 'Financial';
  /** One-paragraph description of the resource's purpose. */
  description: string;
  /** Canonical URL of the resource in the HL7 FHIR R4 spec. */
  url: string;
  elements: FhirElement[];
  examples: AnnotatedExample[];
}

/** A directed reference edge between two resource types. */
export interface ReferenceEdge {
  /** The resource that holds the reference. */
  from: string;
  /** The resource being referenced. */
  to: string;
  /** The element path that creates the reference. */
  via: string;
}
