// Type model for the SERIS Implementation Guide data that this tool renders.
// The data is produced by scripts/generate.mjs from the vendored FHIR package
// (spec/ca.on.oh-seris) and written to src/generated/seris.ts. These types
// describe that generated shape.

/** A single data type a profile element may hold. */
export interface ElementType {
  /** FHIR data type code, e.g. "string", "Reference", "CodeableConcept". */
  code: string;
  /** For Reference types: the profile names this element may point at. */
  targets?: string[];
  /** For Extension types: the name of the extension definition used. */
  extensionProfile?: string;
}

/** A terminology binding on a coded element. */
export interface ElementBinding {
  strength: 'required' | 'extensible' | 'preferred' | 'example';
  /** Canonical URL of the bound value set (version stripped). */
  valueSetUrl?: string;
  /** Resolved value-set name, when it is defined in this IG. */
  valueSetName?: string;
}

/** A fixed or pattern value constraint. */
export interface FixedValue {
  kind: 'fixed' | 'pattern';
  /** The FHIR type of the value (e.g. "CodeableConcept", "code"). */
  type: string;
  value: unknown;
}

/** One element row within a profile or extension differential. */
export interface ProfileElement {
  /** Full element id, including slice names, e.g. "Patient.identifier:MRN.type". */
  id: string;
  /** Leaf label shown in the tree, e.g. "identifier:MRN" or "value[x]". */
  leaf: string;
  /** Nesting depth (1 = direct child of the resource/extension root). */
  depth: number;
  /** Slice name when this element is a slice, e.g. "MRN". */
  sliceName?: string;
  /** Minimum cardinality, when constrained by the differential. */
  min: number | null;
  /** Maximum cardinality ("1", "*", …), when constrained. */
  max: string | null;
  mustSupport: boolean;
  types: ElementType[];
  binding?: ElementBinding;
  fixed?: FixedValue;
  short?: string;
  definition?: string;
}

/** A resource profile constrained by the IG. */
export interface Profile {
  name: string;
  /** The base FHIR resource type the profile constrains. */
  baseType: string;
  url: string;
  description?: string;
  elements: ProfileElement[];
  /** Names of other profiles this one references (for the relationship graph). */
  referencedProfiles: string[];
  /** Names of extensions this profile uses. */
  usedExtensions: string[];
  /** A generated minimal starter instance. */
  template?: TemplateExample;
}

/** An extension definition. */
export interface ExtensionDef {
  name: string;
  url: string;
  /** Where the extension may be used (FHIRPath contexts). */
  contexts: string[];
  description?: string;
  elements: ProfileElement[];
}

/** One include block of a value set's composition. */
export interface ValueSetInclude {
  system?: string;
  systemName?: string;
  concepts: { code: string; display?: string }[];
  /** Human-readable filter descriptions, when concepts are not enumerated. */
  filters?: string[];
}

export interface ValueSetDef {
  name: string;
  url: string;
  description?: string;
  includes: ValueSetInclude[];
}

export interface CodeSystemDef {
  name: string;
  url: string;
  description?: string;
  concepts: { code: string; display?: string; definition?: string }[];
}

/** A resource entry within a CapabilityStatement's REST mode. */
export interface CapabilityResource {
  type: string;
  profile?: string;
  interactions: string[];
}

export interface CapabilityStatementDef {
  name: string;
  description?: string;
  mode?: string;
  resources: CapabilityResource[];
}

/** A directed reference edge between two profiles. */
export interface ReferenceEdge {
  from: string;
  to: string;
  via: string;
}

/** A worked/generated example payload with teaching annotations. */
export interface TemplateExample {
  title: string;
  description: string;
  json: unknown;
  annotations: { path: string; note: string }[];
}

/** The whole generated IG dataset. */
export interface SerisSpec {
  meta: {
    package: string;
    packageVersion: string;
    fhirVersion: string;
    guideVersion: string;
    guideUrl: string;
    canonicalBase: string;
    generatedAt: string;
  };
  profiles: Profile[];
  extensions: ExtensionDef[];
  valueSets: ValueSetDef[];
  codeSystems: CodeSystemDef[];
  capabilityStatements: CapabilityStatementDef[];
  referenceEdges: ReferenceEdge[];
}
