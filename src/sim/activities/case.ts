// OR Case activities: the hospital-facing actions that submit a case event to
// SERIS as a message Bundle. A "case" entity is created on booking and then
// transitioned (performed / cancelled / entered-in-error) by later activities,
// which merge the case's stored values with their new inputs before building the
// message. Conformance is dogfooded by src/sim/coverage.test.ts.

import { buildCaseMessage } from '../build';
import { findEntity } from '../state';
import type { FacilityState } from '../state';
import type { ActivityDef, CaseState, SimEntity } from '../types';

const s = (v: Record<string, unknown>, k: string, fallback = ''): string =>
  typeof v[k] === 'string' && v[k] !== '' ? (v[k] as string) : fallback;

/** Shared identity fields for activities that BOOK a fresh case. */
const caseRefFields: ActivityDef['fields'] = [
  { path: 'patient', label: 'Patient', input: 'entityRef', entityType: 'patient', required: true },
  { path: 'surgeon', label: 'Surgeon', input: 'entityRef', entityType: 'practitioner', required: true },
  { path: 'location', label: 'OR room', input: 'entityRef', entityType: 'location', required: true },
  { path: 'caseId', label: 'Case identifier', input: 'text', required: true, default: 'CASE-0001' },
  { path: 'procedureCode', label: 'Procedure', input: 'select', valueSet: 'ProcedureCode', required: true, help: 'WTIS procedure code.' },
];

const caseEntity = (caseKey: string, state: CaseState, values: Record<string, unknown>): SimEntity => ({
  kind: 'case',
  key: caseKey,
  label: `Case ${caseKey}`,
  values,
  state,
  refs: {
    patient: s(values, 'patient'),
    practitioner: s(values, 'surgeon'),
    location: s(values, 'location'),
  },
});

/** Resolve an existing case + merge its stored values with the activity's inputs. */
function onCase(v: Record<string, unknown>, facility: FacilityState): { key: string; values: Record<string, unknown> } {
  const key = s(v, 'case');
  const c = findEntity(facility, 'case', key);
  return { key: key || s(v, 'caseId', 'CASE-0001'), values: { ...(c?.values ?? {}), ...v } };
}

export const CASE_ACTIVITIES: ActivityDef[] = [
  {
    id: 'case-book',
    ucRef: 'OR Case · UC1',
    track: 'case',
    stage: 'Book',
    title: 'Book elective surgery',
    summary: 'Book a new elective case — transmitted as a case-scheduled message.',
    targetProfiles: ['Encounter', 'Patient'],
    extensions: ['SETPSurgicalPriority', 'SETPBookingDate'],
    fields: [
      ...caseRefFields,
      { path: 'priority', label: 'Surgical priority', input: 'select', valueSet: 'SurgicalPriorityClassification', required: true },
      { path: 'encounterClass', label: 'Encounter class', input: 'select', valueSet: 'EncounterClass' },
      { path: 'encounterType', label: 'Encounter type', input: 'select', valueSet: 'EncounterType' },
      { path: 'periodStart', label: 'Scheduled start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
    ],
    build: (v, facility) => {
      const caseId = s(v, 'caseId', 'CASE-0001');
      const payload = buildCaseMessage({ eventCode: 'case-scheduled', businessStatus: 'booked', values: v, facility });
      return { kind: 'message', payload, entity: caseEntity(caseId, 'booked', v) };
    },
  },
  {
    id: 'case-update-booked',
    ucRef: 'OR Case · UC2',
    track: 'case',
    stage: 'Book',
    title: 'Update a booked case',
    summary: 'Change a booked case (e.g. its OR) — re-transmitted as case-scheduled.',
    targetProfiles: ['Encounter'],
    fields: [
      { path: 'case', label: 'Case', input: 'entityRef', entityType: 'case', required: true },
      { path: 'location', label: 'OR room', input: 'entityRef', entityType: 'location', required: true },
      { path: 'periodStart', label: 'Scheduled start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
    ],
    build: (v, facility) => {
      const { key, values } = onCase(v, facility);
      const payload = buildCaseMessage({ eventCode: 'case-scheduled', businessStatus: 'booked', values, facility });
      return { kind: 'message', payload, entity: caseEntity(key, 'booked', values) };
    },
  },
  {
    id: 'case-perform',
    ucRef: 'OR Case · UC3',
    track: 'case',
    stage: 'Perform',
    title: 'Record a performed case',
    summary: 'Document a performed case — transmitted as a case-performed message.',
    targetProfiles: ['Procedure', 'Encounter', 'MedicationAdministration', 'Observation'],
    extensions: ['InRoom', 'SERISSurgicalChecklist', 'SETPAnaesthesia Type'],
    fields: [
      { path: 'case', label: 'Case', input: 'entityRef', entityType: 'case', required: true },
      { path: 'anaesthesia', label: 'Anaesthesia type', input: 'select', valueSet: 'AnaesthesiaType', required: true },
      { path: 'asa', label: 'ASA physical status', input: 'select', valueSet: 'ASAphysicalStatus', required: true },
      { path: 'complication', label: 'Procedure complication', input: 'select', valueSet: 'ProcedureComplication' },
      { path: 'performedStart', label: 'Procedure start', input: 'datetime', required: true, default: '2025-06-02T08:20:00-04:00' },
      { path: 'performedEnd', label: 'Procedure end', input: 'datetime', required: true, default: '2025-06-02T09:25:00-04:00' },
    ],
    build: (v, facility) => {
      const { key, values } = onCase(v, facility);
      const payload = buildCaseMessage({ eventCode: 'case-performed', businessStatus: 'performed', values, facility });
      return { kind: 'message', payload, entity: caseEntity(key, 'performed', values) };
    },
  },
  {
    id: 'case-update-performed',
    ucRef: 'OR Case · UC4',
    track: 'case',
    stage: 'Perform',
    title: 'Update a performed case',
    summary: 'Amend a performed case — re-transmitted as case-performed.',
    targetProfiles: ['Procedure', 'Observation'],
    extensions: ['SETPAnaesthesia Type'],
    fields: [
      { path: 'case', label: 'Case', input: 'entityRef', entityType: 'case', required: true },
      { path: 'anaesthesia', label: 'Anaesthesia type', input: 'select', valueSet: 'AnaesthesiaType', required: true },
      { path: 'asa', label: 'ASA physical status', input: 'select', valueSet: 'ASAphysicalStatus', required: true },
      { path: 'performedStart', label: 'Procedure start', input: 'datetime', required: true, default: '2025-06-02T08:20:00-04:00' },
      { path: 'performedEnd', label: 'Procedure end', input: 'datetime', required: true, default: '2025-06-02T09:25:00-04:00' },
    ],
    build: (v, facility) => {
      const { key, values } = onCase(v, facility);
      const payload = buildCaseMessage({ eventCode: 'case-performed', businessStatus: 'performed', values, facility });
      return { kind: 'message', payload, entity: caseEntity(key, 'performed', values) };
    },
  },
  {
    id: 'case-addon',
    ucRef: 'OR Case · UC6',
    track: 'case',
    stage: 'Perform',
    title: 'Record an add-on case',
    summary: 'Document an unscheduled add-on case performed — case-performed.',
    targetProfiles: ['Procedure', 'Encounter', 'MedicationAdministration', 'Observation'],
    extensions: ['InRoom', 'SETPAnaesthesia Type'],
    fields: [
      ...caseRefFields,
      { path: 'anaesthesia', label: 'Anaesthesia type', input: 'select', valueSet: 'AnaesthesiaType', required: true },
      { path: 'asa', label: 'ASA physical status', input: 'select', valueSet: 'ASAphysicalStatus', required: true },
      { path: 'performedStart', label: 'Procedure start', input: 'datetime', required: true, default: '2025-06-02T13:00:00-04:00' },
      { path: 'performedEnd', label: 'Procedure end', input: 'datetime', required: true, default: '2025-06-02T14:10:00-04:00' },
    ],
    build: (v, facility) => {
      const caseId = s(v, 'caseId', 'CASE-ADDON-1');
      const payload = buildCaseMessage({ eventCode: 'case-performed', businessStatus: 'performed', values: v, facility });
      return { kind: 'message', payload, entity: caseEntity(caseId, 'performed', v) };
    },
  },
  {
    id: 'case-cancel',
    ucRef: 'OR Case · UC5',
    track: 'case',
    stage: 'Cancel',
    title: 'Cancel an elective case',
    summary: 'Cancel a booked case with reason — transmitted as case-cancelled.',
    targetProfiles: ['Encounter'],
    extensions: ['SERISCancellation', 'SERISReschedule'],
    fields: [
      { path: 'case', label: 'Case', input: 'entityRef', entityType: 'case', required: true },
      { path: 'cancellationReason', label: 'Cancellation reason', input: 'select', valueSet: 'SurgeryCancellationReason', required: true },
      { path: 'cancellationDate', label: 'Cancellation date', input: 'datetime', required: true, default: '2025-06-01T16:20:00-04:00' },
      { path: 'rescheduleDate', label: 'Rescheduled date', input: 'datetime', default: '2025-06-15T07:30:00-04:00' },
    ],
    build: (v, facility) => {
      const { key, values } = onCase(v, facility);
      const payload = buildCaseMessage({ eventCode: 'case-cancelled', businessStatus: 'cancelled', values, facility });
      return { kind: 'message', payload, entity: caseEntity(key, 'cancelled', values) };
    },
  },
  {
    id: 'case-cancel-addon',
    ucRef: 'OR Case · UC7',
    track: 'case',
    stage: 'Cancel',
    title: 'Cancel an add-on case',
    summary: 'Cancel an in-room add-on case — transmitted as case-cancelled.',
    targetProfiles: ['Encounter'],
    extensions: ['SERISCancellation'],
    fields: [
      { path: 'case', label: 'Case', input: 'entityRef', entityType: 'case', required: true },
      { path: 'cancellationReason', label: 'Cancellation reason', input: 'select', valueSet: 'SurgeryCancellationReason', required: true },
      { path: 'cancellationDate', label: 'Cancellation date', input: 'datetime', required: true, default: '2025-06-02T13:30:00-04:00' },
    ],
    build: (v, facility) => {
      const { key, values } = onCase(v, facility);
      const payload = buildCaseMessage({ eventCode: 'case-cancelled', businessStatus: 'cancelled', values, facility });
      return { kind: 'message', payload, entity: caseEntity(key, 'cancelled', values) };
    },
  },
  {
    id: 'case-eie',
    ucRef: 'OR Case · UC8',
    track: 'case',
    stage: 'Corrections',
    title: 'Mark a case entered in error',
    summary: 'Flag a case recorded by mistake — case-cancelled, status entered-in-error.',
    targetProfiles: ['Encounter'],
    extensions: ['SERISCancellation'],
    fields: [
      { path: 'case', label: 'Case', input: 'entityRef', entityType: 'case', required: true },
      { path: 'cancellationReason', label: 'Reason', input: 'select', valueSet: 'SurgeryCancellationReason', required: true },
      { path: 'cancellationDate', label: 'Date', input: 'datetime', required: true, default: '2025-06-02T16:00:00-04:00' },
    ],
    build: (v, facility) => {
      const { key, values } = onCase(v, facility);
      const payload = buildCaseMessage({ eventCode: 'case-cancelled', businessStatus: 'entered-in-error', values, facility });
      return { kind: 'message', payload, entity: caseEntity(key, 'entered-in-error', values) };
    },
  },
];
