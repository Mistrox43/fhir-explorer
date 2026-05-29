import type { FhirResource, ReferenceEdge } from './types';

// A hand-curated slice of the FHIR R4 specification. This is not the full
// spec — it is a teaching subset of common resources, with the elements that
// best illustrate cardinality, data types, codings, and references between
// resources. Add more resources here over time; the UI is fully data-driven.

const SPEC_BASE = 'https://hl7.org/fhir/R4';

export const RESOURCES: FhirResource[] = [
  {
    name: 'Patient',
    category: 'Administrative',
    description:
      'Demographics and other administrative information about an individual receiving care or other health-related services.',
    url: `${SPEC_BASE}/patient.html`,
    elements: [
      {
        path: 'Patient.identifier',
        type: ['Identifier'],
        min: 0,
        max: '*',
        short: 'An identifier for this patient',
        definition:
          'Business identifiers such as a medical record number (MRN) or national health number. Distinct from the resource id.',
        isSummary: true,
      },
      {
        path: 'Patient.active',
        type: ['boolean'],
        min: 0,
        max: '1',
        short: 'Whether this patient record is in active use',
        isModifier: true,
        isSummary: true,
      },
      {
        path: 'Patient.name',
        type: ['HumanName'],
        min: 0,
        max: '*',
        short: 'A name associated with the patient',
        definition:
          'A patient may have multiple names with different uses or applicable periods (e.g. official, nickname, maiden).',
        isSummary: true,
      },
      {
        path: 'Patient.telecom',
        type: ['ContactPoint'],
        min: 0,
        max: '*',
        short: 'A contact detail for the individual',
        isSummary: true,
      },
      {
        path: 'Patient.gender',
        type: ['code'],
        min: 0,
        max: '1',
        short: 'male | female | other | unknown',
        binding: { strength: 'required', valueSet: 'AdministrativeGender' },
        isSummary: true,
      },
      {
        path: 'Patient.birthDate',
        type: ['date'],
        min: 0,
        max: '1',
        short: 'The date of birth for the individual',
        isSummary: true,
      },
      {
        path: 'Patient.managingOrganization',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'Organization that is the custodian of the patient record',
        references: ['Organization'],
        isSummary: true,
      },
      {
        path: 'Patient.generalPractitioner',
        type: ['Reference'],
        min: 0,
        max: '*',
        short: "Patient's nominated primary care provider",
        references: ['Practitioner', 'Organization'],
      },
    ],
    examples: [
      {
        title: 'Minimal patient',
        description:
          'The smallest useful Patient: an identifier, a name, and a few demographics. Notice that almost everything in FHIR is optional.',
        json: {
          resourceType: 'Patient',
          id: 'example',
          identifier: [
            { system: 'http://hospital.example/mrn', value: '12345' },
          ],
          name: [{ use: 'official', family: 'Chalmers', given: ['Peter', 'James'] }],
          gender: 'male',
          birthDate: '1974-12-25',
          managingOrganization: { reference: 'Organization/hl7' },
        },
        annotations: [
          { path: 'resourceType', note: 'Every FHIR resource starts with its type. Required on all resources.' },
          { path: 'identifier[0]', note: 'A business identifier (e.g. MRN), made of a system + value pair so it is globally unambiguous.' },
          { path: 'name[0].given', note: 'Given names are an array — middle names go here too.' },
          { path: 'managingOrganization.reference', note: 'A reference to another resource, written as "ResourceType/id".' },
        ],
      },
    ],
  },
  {
    name: 'Observation',
    category: 'Clinical',
    description:
      'Measurements and simple assertions made about a patient — vital signs, lab results, social history, and more.',
    url: `${SPEC_BASE}/observation.html`,
    elements: [
      {
        path: 'Observation.status',
        type: ['code'],
        min: 1,
        max: '1',
        short: 'registered | preliminary | final | amended | ...',
        definition: 'The status of the result value. Required on every Observation.',
        binding: { strength: 'required', valueSet: 'ObservationStatus' },
        isModifier: true,
        isSummary: true,
      },
      {
        path: 'Observation.category',
        type: ['CodeableConcept'],
        min: 0,
        max: '*',
        short: 'Classification of type of observation',
        binding: { strength: 'preferred', valueSet: 'ObservationCategoryCodes' },
      },
      {
        path: 'Observation.code',
        type: ['CodeableConcept'],
        min: 1,
        max: '1',
        short: 'Type of observation (the "what")',
        definition: 'Describes what was observed, typically a LOINC code. Required.',
        binding: { strength: 'example', valueSet: 'LOINCCodes' },
        isSummary: true,
      },
      {
        path: 'Observation.subject',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'Who/what the observation is about',
        references: ['Patient'],
        isSummary: true,
      },
      {
        path: 'Observation.encounter',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'Healthcare event during which this observation was made',
        references: ['Encounter'],
      },
      {
        path: 'Observation.effectiveDateTime',
        type: ['dateTime'],
        min: 0,
        max: '1',
        short: 'Clinically relevant time of the observation',
        isSummary: true,
      },
      {
        path: 'Observation.valueQuantity',
        type: ['Quantity'],
        min: 0,
        max: '1',
        short: 'Actual result, as a measured quantity',
        definition:
          'value[x] is a choice type — the result can be a Quantity, CodeableConcept, string, boolean, and more.',
        isSummary: true,
      },
      {
        path: 'Observation.performer',
        type: ['Reference'],
        min: 0,
        max: '*',
        short: 'Who is responsible for the observation',
        references: ['Practitioner', 'Organization'],
      },
    ],
    examples: [
      {
        title: 'Body weight vital sign',
        description:
          'A final body-weight measurement of 72.5 kg, coded with LOINC and linked to a patient and encounter.',
        json: {
          resourceType: 'Observation',
          id: 'body-weight',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                },
              ],
            },
          ],
          code: {
            coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' }],
          },
          subject: { reference: 'Patient/example' },
          encounter: { reference: 'Encounter/example' },
          effectiveDateTime: '2026-05-20T09:30:00Z',
          valueQuantity: { value: 72.5, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' },
        },
        annotations: [
          { path: 'status', note: '"final" means the result is complete and verified. status is a modifier element.' },
          { path: 'code.coding[0]', note: 'LOINC code 29463-7 universally identifies "Body Weight".' },
          { path: 'valueQuantity', note: 'The result value. Units use UCUM codes so software can convert them.' },
          { path: 'subject.reference', note: 'Links this measurement back to the Patient it belongs to.' },
        ],
      },
    ],
  },
  {
    name: 'Encounter',
    category: 'Administrative',
    description:
      'An interaction between a patient and healthcare provider(s) for the purpose of providing healthcare services or assessing health status.',
    url: `${SPEC_BASE}/encounter.html`,
    elements: [
      {
        path: 'Encounter.status',
        type: ['code'],
        min: 1,
        max: '1',
        short: 'planned | arrived | in-progress | finished | cancelled | ...',
        binding: { strength: 'required', valueSet: 'EncounterStatus' },
        isModifier: true,
        isSummary: true,
      },
      {
        path: 'Encounter.class',
        type: ['Coding'],
        min: 1,
        max: '1',
        short: 'Classification of encounter (inpatient, outpatient, emergency...)',
        binding: { strength: 'extensible', valueSet: 'ActEncounterCode' },
        isSummary: true,
      },
      {
        path: 'Encounter.subject',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'The patient present at the encounter',
        references: ['Patient'],
        isSummary: true,
      },
      {
        path: 'Encounter.participant',
        type: ['BackboneElement'],
        min: 0,
        max: '*',
        short: 'List of participants involved in the encounter',
      },
      {
        path: 'Encounter.participant.individual',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'Person involved in the encounter',
        references: ['Practitioner', 'Patient'],
      },
      {
        path: 'Encounter.serviceProvider',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'The organization responsible for this encounter',
        references: ['Organization'],
      },
    ],
    examples: [
      {
        title: 'Finished outpatient visit',
        description: 'A completed ambulatory encounter for a patient, provided by an organization.',
        json: {
          resourceType: 'Encounter',
          id: 'example',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
          subject: { reference: 'Patient/example' },
          serviceProvider: { reference: 'Organization/hl7' },
        },
        annotations: [
          { path: 'class', note: '"AMB" = ambulatory (outpatient). class uses a single Coding, not a full CodeableConcept.' },
          { path: 'subject.reference', note: 'The Patient seen during this encounter.' },
        ],
      },
    ],
  },
  {
    name: 'Practitioner',
    category: 'Administrative',
    description:
      'A person who is directly or indirectly involved in the provisioning of healthcare — doctors, nurses, technicians, and others.',
    url: `${SPEC_BASE}/practitioner.html`,
    elements: [
      {
        path: 'Practitioner.identifier',
        type: ['Identifier'],
        min: 0,
        max: '*',
        short: 'An identifier for the person as this practitioner',
        isSummary: true,
      },
      {
        path: 'Practitioner.active',
        type: ['boolean'],
        min: 0,
        max: '1',
        short: 'Whether this practitioner record is in active use',
        isSummary: true,
      },
      {
        path: 'Practitioner.name',
        type: ['HumanName'],
        min: 0,
        max: '*',
        short: 'The name(s) associated with the practitioner',
        isSummary: true,
      },
      {
        path: 'Practitioner.qualification',
        type: ['BackboneElement'],
        min: 0,
        max: '*',
        short: 'Certification, licenses, or training pertaining to the provision of care',
      },
    ],
    examples: [
      {
        title: 'A physician',
        description: 'A simple Practitioner with a license identifier and an official name.',
        json: {
          resourceType: 'Practitioner',
          id: 'example',
          active: true,
          identifier: [{ system: 'http://example.org/licenses', value: 'AB-1234' }],
          name: [{ use: 'official', family: 'Careful', given: ['Adam'], prefix: ['Dr'] }],
        },
        annotations: [
          { path: 'name[0].prefix', note: 'Prefix carries titles like "Dr". Like given names, it is an array.' },
        ],
      },
    ],
  },
  {
    name: 'Organization',
    category: 'Administrative',
    description:
      'A formally or informally recognized grouping of people or organizations — a hospital, department, insurer, or ward.',
    url: `${SPEC_BASE}/organization.html`,
    elements: [
      {
        path: 'Organization.identifier',
        type: ['Identifier'],
        min: 0,
        max: '*',
        short: 'Identifies this organization across multiple systems',
        isSummary: true,
      },
      {
        path: 'Organization.active',
        type: ['boolean'],
        min: 0,
        max: '1',
        short: "Whether the organization's record is still in active use",
        isModifier: true,
        isSummary: true,
      },
      {
        path: 'Organization.type',
        type: ['CodeableConcept'],
        min: 0,
        max: '*',
        short: 'Kind of organization',
        binding: { strength: 'example', valueSet: 'OrganizationType' },
      },
      {
        path: 'Organization.name',
        type: ['string'],
        min: 0,
        max: '1',
        short: 'Name used for the organization',
        isSummary: true,
      },
      {
        path: 'Organization.partOf',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'The organization of which this organization forms a part',
        references: ['Organization'],
        isSummary: true,
      },
    ],
    examples: [
      {
        title: 'A health-level-seven org',
        description: 'A named organization, optionally nested within a parent organization.',
        json: {
          resourceType: 'Organization',
          id: 'hl7',
          active: true,
          name: 'Health Level Seven International',
          type: [
            {
              coding: [
                { system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'edu' },
              ],
            },
          ],
        },
        annotations: [
          { path: 'partOf', note: 'partOf lets organizations reference themselves to model hierarchies (e.g. a ward within a hospital).' },
        ],
      },
    ],
  },
  {
    name: 'Condition',
    category: 'Clinical',
    description:
      'A clinical condition, problem, diagnosis, or other event that has risen to a level of concern.',
    url: `${SPEC_BASE}/condition.html`,
    elements: [
      {
        path: 'Condition.clinicalStatus',
        type: ['CodeableConcept'],
        min: 0,
        max: '1',
        short: 'active | recurrence | relapse | inactive | remission | resolved',
        binding: { strength: 'required', valueSet: 'ConditionClinicalStatusCodes' },
        isModifier: true,
        isSummary: true,
      },
      {
        path: 'Condition.code',
        type: ['CodeableConcept'],
        min: 0,
        max: '1',
        short: 'Identification of the condition, problem or diagnosis',
        binding: { strength: 'example', valueSet: 'ConditionProblemDiagnosisCodes' },
        isSummary: true,
      },
      {
        path: 'Condition.subject',
        type: ['Reference'],
        min: 1,
        max: '1',
        short: 'Who has the condition',
        definition: 'Required reference to the patient or group with the condition.',
        references: ['Patient'],
        isSummary: true,
      },
      {
        path: 'Condition.encounter',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'The encounter during which this was created',
        references: ['Encounter'],
      },
      {
        path: 'Condition.recorder',
        type: ['Reference'],
        min: 0,
        max: '1',
        short: 'Who recorded the condition',
        references: ['Practitioner'],
      },
    ],
    examples: [
      {
        title: 'Active diagnosis',
        description: 'An active condition coded with SNOMED CT, recorded against a patient during an encounter.',
        json: {
          resourceType: 'Condition',
          id: 'example',
          clinicalStatus: {
            coding: [
              { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' },
            ],
          },
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '386661006', display: 'Fever' }],
          },
          subject: { reference: 'Patient/example' },
          encounter: { reference: 'Encounter/example' },
        },
        annotations: [
          { path: 'clinicalStatus', note: 'A modifier element: marking a condition "resolved" vs "active" changes its meaning entirely.' },
          { path: 'subject.reference', note: 'subject is required (min = 1) — a condition must be about someone.' },
        ],
      },
    ],
  },
];

/** Fast lookup of a resource by name. */
export const RESOURCE_BY_NAME: Record<string, FhirResource> = Object.fromEntries(
  RESOURCES.map((r) => [r.name, r]),
);

/** All reference edges between curated resources, derived from element data. */
export function getReferenceEdges(): ReferenceEdge[] {
  const edges: ReferenceEdge[] = [];
  for (const resource of RESOURCES) {
    for (const element of resource.elements) {
      if (!element.references) continue;
      for (const target of element.references) {
        // Only draw edges to resources we actually have curated.
        if (RESOURCE_BY_NAME[target]) {
          edges.push({ from: resource.name, to: target, via: element.path });
        }
      }
    }
  }
  return edges;
}
