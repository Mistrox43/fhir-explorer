// OR Schedule activities: the hospital-facing actions that submit a single
// FHIR resource over REST (create/update of a Location, Schedule, or Slot). Each
// activity declares its form fields and a `build` that turns the entered values
// + the running facility state into a conformant payload, mirroring the shapes
// in src/fhir/scheduleRest.ts. (Coverage of every constrained element/extension
// is enforced by src/sim/coverage.test.ts.)

import { FACILITY, SD, SNOMED, envMeta } from '../fhirBuild';
import { findEntity } from '../state';
import type { FacilityState } from '../state';
import type { ActivityDef, SimEntity } from '../types';

const LOC_SYS = 'http://hospital.example/locations';
const SCH_SYS = 'http://hospital.example/schedules';
const SLOT_SYS = 'http://hospital.example/slots';

const s = (v: Record<string, unknown>, k: string, fallback = ''): string =>
  typeof v[k] === 'string' && v[k] !== '' ? (v[k] as string) : fallback;
/** A CodeableConcept select value stored by the form, or undefined. */
const concept = (v: Record<string, unknown>, k: string): Record<string, unknown> | undefined =>
  v[k] && typeof v[k] === 'object' ? (v[k] as Record<string, unknown>) : undefined;

/** Resolve the facility id (meta.tag) of a schedule the user picked. */
const facilityForSchedule = (facility: FacilityState, scheduleKey: string): string => {
  const sch = findEntity(facility, 'schedule', scheduleKey);
  return sch?.facilityId ?? facility.facilityId;
};

export const SCHEDULE_ACTIVITIES: ActivityDef[] = [
  {
    id: 'sched-room',
    ucRef: 'OR Schedule · UC16',
    track: 'schedule',
    stage: 'Set up capacity',
    title: 'Create a new OR room',
    summary: 'Register a new operating room for the site (a Location).',
    targetProfiles: ['Location'],
    extensions: ['ORUnit'],
    fields: [
      { path: 'facilityId', label: 'Room facility id', input: 'text', required: true, default: '4001', help: "The room's facility id — goes in meta.tag; SERIS references the OR by it." },
      { path: 'identifier.value', label: 'Room identifier', input: 'text', required: true, default: 'OR-4', help: 'Local business identifier for the room.' },
      { path: 'name', label: 'Room name', input: 'text', required: true, default: 'OR-4' },
      {
        path: 'status', label: 'Status', input: 'select', required: true, default: 'active',
        options: [
          { value: 'active', label: 'active — in use' },
          { value: 'suspended', label: 'suspended' },
          { value: 'inactive', label: 'inactive — decommissioned' },
        ],
      },
      { path: 'orUnit', label: 'OR unit', input: 'text', default: 'Main OR Suite', help: 'SERIS OR Unit extension (free text).' },
    ],
    build: (v, facility) => {
      const facilityId = s(v, 'facilityId', facility.facilityId);
      const id = s(v, 'identifier.value', 'OR-4');
      const name = s(v, 'name', id);
      const payload = {
        resourceType: 'Location',
        meta: envMeta('Location', facilityId),
        extension: [{ url: `${SD}/ca-on-seris-ext-or-unit`, valueString: s(v, 'orUnit', 'Main OR Suite') }],
        identifier: [{ system: LOC_SYS, value: id }],
        status: s(v, 'status', 'active'),
        name,
        type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'OR', display: 'Operating Room' }] }],
        partOf: { identifier: { system: FACILITY, value: '4000' } },
      };
      const entity: SimEntity = { kind: 'location', key: id, system: LOC_SYS, label: `${name} — Operating Room`, values: v, facilityId };
      return { kind: 'rest', method: 'POST', endpoint: '/Location', payload, entity };
    },
  },
  {
    id: 'sched-create',
    ucRef: 'OR Schedule · UC1',
    track: 'schedule',
    stage: 'Set up capacity',
    title: 'Create a new OR schedule',
    summary: 'Open a schedule (a shift) declaring when a room is available.',
    targetProfiles: ['Schedule'],
    extensions: ['ShiftType', 'HoursOfOperation'],
    fields: [
      { path: 'room', label: 'OR room', input: 'entityRef', entityType: 'location', required: true, help: 'The room this schedule is for.' },
      { path: 'identifier.value', label: 'Schedule identifier', input: 'text', required: true, default: 'SCH-OR4-2025-06-02' },
      { path: 'shiftType', label: 'Shift type', input: 'text', default: 'Day' },
      { path: 'startTime', label: 'Shift start time', input: 'time', default: '07:30:00' },
      { path: 'stopTime', label: 'Shift stop time', input: 'time', default: '15:30:00' },
      { path: 'daysOfWeek', label: 'Days of week', input: 'text', default: 'Mon-Fri' },
      { path: 'horizonStart', label: 'Planning horizon — start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'horizonEnd', label: 'Planning horizon — end', input: 'datetime', required: true, default: '2025-06-02T15:30:00-04:00' },
    ],
    build: (v, facility) => {
      const room = findEntity(facility, 'location', s(v, 'room'));
      const facilityId = room?.facilityId ?? facility.facilityId;
      const id = s(v, 'identifier.value', 'SCH-OR4-2025-06-02');
      const payload = {
        resourceType: 'Schedule',
        meta: envMeta('Schedule', facilityId),
        extension: [
          { url: `${SD}/ca-on-seris-ext-shift-type`, valueString: s(v, 'shiftType', 'Day') },
          {
            url: `${SD}/ca-on-seris-ext-hours-of-operation`,
            extension: [
              { url: 'startTime', valueTime: s(v, 'startTime', '07:30:00') },
              { url: 'stopTime', valueTime: s(v, 'stopTime', '15:30:00') },
              { url: 'daysOfWeek', valueString: s(v, 'daysOfWeek', 'Mon-Fri') },
            ],
          },
        ],
        identifier: [{ system: SCH_SYS, value: id }],
        active: true,
        actor: [{ identifier: { system: FACILITY, value: facilityId } }],
        planningHorizon: { start: s(v, 'horizonStart'), end: s(v, 'horizonEnd') },
      };
      const label = room ? `Schedule ${id} · ${room.label}` : `Schedule ${id}`;
      const entity: SimEntity = { kind: 'schedule', key: id, system: SCH_SYS, label, values: v, facilityId, refs: room ? { location: room.key } : undefined };
      return { kind: 'rest', method: 'POST', endpoint: '/Schedule', payload, entity };
    },
  },
  {
    id: 'sched-create-slot',
    ucRef: 'OR Schedule · UC6',
    track: 'schedule',
    stage: 'Set up capacity',
    title: 'Create a new slot',
    summary: 'Add a bookable slot inside a schedule.',
    targetProfiles: ['Slot'],
    extensions: ['SlotName'],
    fields: [
      { path: 'schedule', label: 'Schedule', input: 'entityRef', entityType: 'schedule', required: true },
      { path: 'identifier.value', label: 'Slot identifier', input: 'text', required: true, default: 'SLOT-AM-2' },
      { path: 'slotName', label: 'Slot name', input: 'text', default: 'AM Slot 2', help: 'SERIS Slot Name extension.' },
      { path: 'serviceType', label: 'Service type', input: 'select', valueSet: 'HospitalService', help: 'Surgical service the slot is for.' },
      {
        path: 'status', label: 'Status', input: 'select', required: true, default: 'free',
        options: [
          { value: 'free', label: 'free — bookable' },
          { value: 'busy', label: 'busy' },
          { value: 'busy-unavailable', label: 'busy-unavailable' },
        ],
      },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T13:00:00-04:00' },
    ],
    build: (v, facility) => {
      const scheduleKey = s(v, 'schedule');
      const facilityId = facilityForSchedule(facility, scheduleKey);
      const id = s(v, 'identifier.value', 'SLOT-AM-2');
      const serviceType = concept(v, 'serviceType') ?? { coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] };
      const payload = {
        resourceType: 'Slot',
        meta: envMeta('Slot', facilityId),
        extension: [{ url: `${SD}/ca-on-seris-ext-slot-name`, valueString: s(v, 'slotName', 'AM Slot 2') }],
        identifier: [{ system: SLOT_SYS, value: id }],
        serviceType: [serviceType],
        schedule: { identifier: { system: SCH_SYS, value: scheduleKey } },
        status: s(v, 'status', 'free'),
        start: s(v, 'start'),
        end: s(v, 'end'),
      };
      const entity: SimEntity = { kind: 'slot', key: id, system: SLOT_SYS, label: `${id} (${s(v, 'status', 'free')})`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-add-block',
    ucRef: 'OR Schedule · UC2',
    track: 'schedule',
    stage: 'Allocate & adjust blocks',
    title: 'Add a block to the schedule',
    summary: 'Reserve recurring OR time for a service and surgeon (a block on a Slot).',
    targetProfiles: ['Slot'],
    extensions: ['SERISBlock', 'BlockService', 'BlockSurgeons'],
    fields: [
      { path: 'schedule', label: 'Schedule', input: 'entityRef', entityType: 'schedule', required: true },
      { path: 'identifier.value', label: 'Slot identifier', input: 'text', required: true, default: 'SLOT-2' },
      { path: 'blockService', label: 'Block service', input: 'select', valueSet: 'HospitalService', required: true, help: 'Surgical service the block is for.' },
      { path: 'blockSurgeon', label: 'Block surgeon (CPSO id)', input: 'text', required: true, default: '12345', help: 'Surgeon identifier the block is reserved for.' },
      { path: 'serviceType', label: 'Service type', input: 'select', valueSet: 'HospitalService' },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const scheduleKey = s(v, 'schedule');
      const facilityId = facilityForSchedule(facility, scheduleKey);
      const id = s(v, 'identifier.value', 'SLOT-2');
      const blockService = concept(v, 'blockService') ?? { coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] };
      const serviceType = concept(v, 'serviceType') ?? blockService;
      const payload = {
        resourceType: 'Slot',
        meta: envMeta('Slot', facilityId),
        extension: [
          {
            url: `${SD}/ca-on-seris-ext-block`,
            extension: [
              { url: 'blockService', valueCodeableConcept: blockService },
              { url: 'blockSurgeons', valueIdentifier: { system: 'http://example.org/cpso', value: s(v, 'blockSurgeon', '12345') } },
            ],
          },
        ],
        identifier: [{ system: SLOT_SYS, value: id }],
        serviceType: [serviceType],
        schedule: { identifier: { system: SCH_SYS, value: scheduleKey } },
        status: 'busy-unavailable',
        start: s(v, 'start'),
        end: s(v, 'end'),
      };
      const entity: SimEntity = { kind: 'slot', key: id, system: SLOT_SYS, label: `${id} (block)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
];
