// OR Schedule activities: the hospital-facing actions that submit a single
// FHIR resource over REST (create/update of a Location, Schedule, or Slot). Each
// activity declares its form fields and a `build` that turns the entered values
// + the running facility state into a conformant payload, mirroring the shapes
// in src/fhir/scheduleRest.ts. (Coverage of every constrained element/extension
// is enforced by src/sim/coverage.test.ts.)

import { CS, FACILITY, SD, SNOMED, envMeta } from '../fhirBuild';
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

/** Resolve the schedule + facility for an existing slot the user picked. */
const slotContext = (facility: FacilityState, slotKey: string): { scheduleKey: string; facilityId: string } => {
  const slot = findEntity(facility, 'slot', slotKey);
  const scheduleKey = slot?.refs?.schedule ?? '';
  return { scheduleKey, facilityId: slot?.facilityId ?? facilityForSchedule(facility, scheduleKey) };
};

const CARDIAC = { coding: [{ system: SNOMED, code: '310142007', display: 'Cardiac surgery service' }] };

/** Common Slot envelope shared by the block/closure/correction activities. */
function slotPayload(opts: {
  facilityId: string;
  id: string;
  scheduleKey: string;
  serviceType: Record<string, unknown>;
  status: string;
  start: string;
  end: string;
  extension?: unknown[];
}): Record<string, unknown> {
  return {
    resourceType: 'Slot',
    meta: envMeta('Slot', opts.facilityId),
    ...(opts.extension ? { extension: opts.extension } : {}),
    identifier: [{ system: SLOT_SYS, value: opts.id }],
    serviceType: [opts.serviceType],
    schedule: { identifier: { system: SCH_SYS, value: opts.scheduleKey } },
    status: opts.status,
    start: opts.start,
    end: opts.end,
  };
}

function schedulePayload(opts: {
  facilityId: string;
  id: string;
  active: boolean;
  horizonStart: string;
  horizonEnd: string;
  extension?: unknown[];
}): Record<string, unknown> {
  return {
    resourceType: 'Schedule',
    meta: envMeta('Schedule', opts.facilityId),
    ...(opts.extension ? { extension: opts.extension } : {}),
    identifier: [{ system: SCH_SYS, value: opts.id }],
    active: opts.active,
    actor: [{ identifier: { system: FACILITY, value: opts.facilityId } }],
    planningHorizon: { start: opts.horizonStart, end: opts.horizonEnd },
  };
}

function locationPayload(opts: {
  facilityId: string;
  id: string;
  name: string;
  status: string;
  extension?: unknown[];
}): Record<string, unknown> {
  return {
    resourceType: 'Location',
    meta: envMeta('Location', opts.facilityId),
    extension: [
      { url: `${SD}/ca-on-seris-ext-or-unit`, valueString: 'Main OR Suite' },
      ...(opts.extension ?? []),
    ],
    identifier: [{ system: LOC_SYS, value: opts.id }],
    status: opts.status,
    name: opts.name,
    type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'OR', display: 'Operating Room' }] }],
    partOf: { identifier: { system: FACILITY, value: '4000' } },
  };
}

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
  {
    id: 'sched-modify-block',
    ucRef: 'OR Schedule · UC4',
    track: 'schedule',
    stage: 'Allocate & adjust blocks',
    title: 'Modify a block',
    summary: "Reassign a block's service or surgeon, recording why it changed.",
    targetProfiles: ['Slot'],
    extensions: ['SERISBlock', 'SERISBlockChange'],
    fields: [
      { path: 'slot', label: 'Block slot', input: 'entityRef', entityType: 'slot', required: true },
      { path: 'blockService', label: 'New block service', input: 'select', valueSet: 'HospitalService', required: true },
      { path: 'blockSurgeon', label: 'New surgeon (CPSO id)', input: 'text', required: true, default: '12345' },
      { path: 'changeReason', label: 'Change reason', input: 'select', valueSet: 'BlockChangeReason', required: true },
      { path: 'changeDate', label: 'Change date', input: 'datetime', default: '2025-05-30T09:00:00-04:00' },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const slotKey = s(v, 'slot');
      const { scheduleKey, facilityId } = slotContext(facility, slotKey);
      const blockService = concept(v, 'blockService') ?? CARDIAC;
      const changeReason = concept(v, 'changeReason') ?? { coding: [{ system: `${CS}/block-change-reason`, code: 'se-ch', display: 'Service Changed' }] };
      const payload = slotPayload({
        facilityId, id: slotKey, scheduleKey, serviceType: blockService, status: 'busy-unavailable',
        start: s(v, 'start'), end: s(v, 'end'),
        extension: [
          { url: `${SD}/ca-on-seris-ext-block`, extension: [
            { url: 'blockService', valueCodeableConcept: blockService },
            { url: 'blockSurgeons', valueIdentifier: { system: 'http://example.org/cpso', value: s(v, 'blockSurgeon', '12345') } },
          ] },
          { url: `${SD}/ca-on-seris-ext-blockchange`, extension: [
            { url: 'changeReason', valueCodeableConcept: changeReason },
            { url: 'changeDate', valueDateTime: s(v, 'changeDate', '2025-05-30T09:00:00-04:00') },
          ] },
        ],
      });
      const entity: SimEntity = { kind: 'slot', key: slotKey, system: SLOT_SYS, label: `${slotKey} (block · modified)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-adjust-block',
    ucRef: 'OR Schedule · UC5',
    track: 'schedule',
    stage: 'Allocate & adjust blocks',
    title: 'Adjust block metadata',
    summary: 'Fine-tune a block’s release frequency and auto-release window.',
    targetProfiles: ['Slot'],
    extensions: ['SERISBlock', 'SETPBlockFrequency', 'SETPBlockAutoRelease'],
    fields: [
      { path: 'slot', label: 'Block slot', input: 'entityRef', entityType: 'slot', required: true },
      { path: 'blockFrequency', label: 'Release frequency', input: 'text', default: 'Weekly' },
      { path: 'blockAutoRelease', label: 'Auto-release (hours)', input: 'number', default: 48 },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const slotKey = s(v, 'slot');
      const { scheduleKey, facilityId } = slotContext(facility, slotKey);
      const autoRelease = typeof v.blockAutoRelease === 'number' ? (v.blockAutoRelease as number) : 48;
      const payload = slotPayload({
        facilityId, id: slotKey, scheduleKey, serviceType: CARDIAC, status: 'busy-unavailable',
        start: s(v, 'start'), end: s(v, 'end'),
        extension: [
          { url: `${SD}/ca-on-seris-ext-block`, extension: [
            { url: 'blockFrequency', valueString: s(v, 'blockFrequency', 'Weekly') },
            { url: 'blockAutoRelease', valueInteger: autoRelease },
          ] },
        ],
      });
      const entity: SimEntity = { kind: 'slot', key: slotKey, system: SLOT_SYS, label: `${slotKey} (block · adjusted)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-remove-block',
    ucRef: 'OR Schedule · UC3',
    track: 'schedule',
    stage: 'Allocate & adjust blocks',
    title: 'Release a block',
    summary: 'Deallocate a block, freeing its reserved time with a release reason.',
    targetProfiles: ['Slot'],
    extensions: ['SERISBlockRelease'],
    fields: [
      { path: 'slot', label: 'Block slot', input: 'entityRef', entityType: 'slot', required: true },
      { path: 'releaseReason', label: 'Release reason', input: 'select', valueSet: 'BlockReleaseReason', required: true },
      { path: 'releaseDate', label: 'Release date', input: 'datetime', default: '2025-05-30T09:00:00-04:00' },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const slotKey = s(v, 'slot');
      const { scheduleKey, facilityId } = slotContext(facility, slotKey);
      const releaseReason = concept(v, 'releaseReason') ?? { coding: [{ system: `${CS}/block-release-reason`, code: 'sr', display: 'Surgeon Request' }] };
      const payload = slotPayload({
        facilityId, id: slotKey, scheduleKey, serviceType: CARDIAC, status: 'free',
        start: s(v, 'start'), end: s(v, 'end'),
        extension: [
          { url: `${SD}/ca-on-seris-ext-block-release`, extension: [
            { url: 'releaseReason', valueCodeableConcept: releaseReason },
            { url: 'releaseDate', valueDateTime: s(v, 'releaseDate', '2025-05-30T09:00:00-04:00') },
          ] },
        ],
      });
      const entity: SimEntity = { kind: 'slot', key: slotKey, system: SLOT_SYS, label: `${slotKey} (free · released)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-slot-duration',
    ucRef: 'OR Schedule · UC8',
    track: 'schedule',
    stage: 'Maintain slots, rooms & horizon',
    title: 'Modify slot duration',
    summary: 'Adjust a slot’s start/end so the shift stays continuous.',
    targetProfiles: ['Slot'],
    fields: [
      { path: 'slot', label: 'Slot', input: 'entityRef', entityType: 'slot', required: true },
      {
        path: 'status', label: 'Status', input: 'select', required: true, default: 'free',
        options: [
          { value: 'free', label: 'free' },
          { value: 'busy', label: 'busy' },
          { value: 'busy-unavailable', label: 'busy-unavailable' },
        ],
      },
      { path: 'start', label: 'New start', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
      { path: 'end', label: 'New end', input: 'datetime', required: true, default: '2025-06-02T14:00:00-04:00' },
    ],
    build: (v, facility) => {
      const slotKey = s(v, 'slot');
      const { scheduleKey, facilityId } = slotContext(facility, slotKey);
      const payload = slotPayload({
        facilityId, id: slotKey, scheduleKey, serviceType: CARDIAC, status: s(v, 'status', 'free'),
        start: s(v, 'start'), end: s(v, 'end'),
      });
      const entity: SimEntity = { kind: 'slot', key: slotKey, system: SLOT_SYS, label: `${slotKey} (${s(v, 'status', 'free')})`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-temp-close',
    ucRef: 'OR Schedule · UC11',
    track: 'schedule',
    stage: 'Closures',
    title: 'Temporary OR closure',
    summary: 'Mark a slot unavailable for a closure period, with a reason.',
    targetProfiles: ['Slot'],
    extensions: ['SETPClosure'],
    fields: [
      { path: 'schedule', label: 'Schedule', input: 'entityRef', entityType: 'schedule', required: true },
      { path: 'identifier.value', label: 'Closure slot id', input: 'text', required: true, default: 'SLOT-CLOSE-1' },
      { path: 'closureReason', label: 'Closure reason', input: 'select', valueSet: 'ORClosureReason', required: true },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-07-01T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-07-01T15:30:00-04:00' },
    ],
    build: (v, facility) => {
      const scheduleKey = s(v, 'schedule');
      const facilityId = facilityForSchedule(facility, scheduleKey);
      const id = s(v, 'identifier.value', 'SLOT-CLOSE-1');
      const closureReason = concept(v, 'closureReason') ?? { coding: [{ system: `${CS}/or-closure-reason`, code: 'p-h', display: 'Planned-Holidays' }] };
      const payload = slotPayload({
        facilityId, id, scheduleKey, serviceType: CARDIAC, status: 'busy-unavailable',
        start: s(v, 'start'), end: s(v, 'end'),
        extension: [{ url: `${SD}/ca-on-setp-ext-closures`, valueCodeableConcept: closureReason }],
      });
      const entity: SimEntity = { kind: 'slot', key: id, system: SLOT_SYS, label: `${id} (closed)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-eie',
    ucRef: 'OR Schedule · UC14',
    track: 'schedule',
    stage: 'Corrections',
    title: 'Mark a slot entered in error',
    summary: 'Flag a slot created by mistake as entered-in-error.',
    targetProfiles: ['Slot'],
    extensions: ['StatusRemoved'],
    fields: [
      { path: 'slot', label: 'Slot', input: 'entityRef', entityType: 'slot', required: true },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const slotKey = s(v, 'slot');
      const { scheduleKey, facilityId } = slotContext(facility, slotKey);
      const payload = slotPayload({
        facilityId, id: slotKey, scheduleKey, serviceType: CARDIAC, status: 'entered-in-error',
        start: s(v, 'start'), end: s(v, 'end'),
        extension: [{ url: `${SD}/ca-on-seris-ext-is-removed`, valueBoolean: true }],
      });
      const entity: SimEntity = { kind: 'slot', key: slotKey, system: SLOT_SYS, label: `${slotKey} (entered-in-error)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-remove-slot',
    ucRef: 'OR Schedule · UC15',
    track: 'schedule',
    stage: 'Corrections',
    title: 'Remove a block or slot',
    summary: 'Delete a slot from an active schedule.',
    targetProfiles: ['Slot'],
    extensions: ['StatusRemoved'],
    fields: [
      { path: 'slot', label: 'Slot', input: 'entityRef', entityType: 'slot', required: true },
      { path: 'start', label: 'Start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'end', label: 'End', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const slotKey = s(v, 'slot');
      const { scheduleKey, facilityId } = slotContext(facility, slotKey);
      const payload = slotPayload({
        facilityId, id: slotKey, scheduleKey, serviceType: CARDIAC, status: 'free',
        start: s(v, 'start'), end: s(v, 'end'),
        extension: [{ url: `${SD}/ca-on-seris-ext-is-removed`, valueBoolean: true }],
      });
      const entity: SimEntity = { kind: 'slot', key: slotKey, system: SLOT_SYS, label: `${slotKey} (removed)`, values: v, facilityId, refs: { schedule: scheduleKey } };
      return { kind: 'rest', method: 'POST', endpoint: '/Slot', payload, entity };
    },
  },
  {
    id: 'sched-room-details',
    ucRef: 'OR Schedule · UC9',
    track: 'schedule',
    stage: 'Maintain slots, rooms & horizon',
    title: 'Update OR room details',
    summary: 'Update a room’s name, MIS functional centre, or status.',
    targetProfiles: ['Location'],
    extensions: ['MisFunctionalCentre', 'ORUnit'],
    fields: [
      { path: 'location', label: 'OR room', input: 'entityRef', entityType: 'location', required: true },
      { path: 'name', label: 'Room name', input: 'text', required: true, default: 'OR-3' },
      { path: 'misFunctionalCentre', label: 'MIS functional centre', input: 'select', valueSet: 'MISFunctionalCentre' },
      {
        path: 'status', label: 'Status', input: 'select', required: true, default: 'active',
        options: [
          { value: 'active', label: 'active' },
          { value: 'suspended', label: 'suspended' },
          { value: 'inactive', label: 'inactive' },
        ],
      },
    ],
    build: (v, facility) => {
      const locKey = s(v, 'location');
      const loc = findEntity(facility, 'location', locKey);
      const facilityId = loc?.facilityId ?? facility.facilityId;
      const mis = concept(v, 'misFunctionalCentre');
      const payload = locationPayload({
        facilityId, id: locKey || 'OR-3', name: s(v, 'name', 'OR-3'), status: s(v, 'status', 'active'),
        extension: mis ? [{ url: `${SD}/ca-on-seris-ext-mis-functional-centre`, valueCodeableConcept: mis }] : [],
      });
      const entity: SimEntity = { kind: 'location', key: locKey || 'OR-3', system: LOC_SYS, label: `${s(v, 'name', 'OR-3')} — Operating Room`, values: v, facilityId };
      return { kind: 'rest', method: 'POST', endpoint: '/Location', payload, entity };
    },
  },
  {
    id: 'sched-perm-close',
    ucRef: 'OR Schedule · UC12',
    track: 'schedule',
    stage: 'Closures',
    title: 'Permanent OR room closure',
    summary: 'Decommission a room: mark the Location inactive.',
    targetProfiles: ['Location'],
    extensions: ['ORUnit'],
    fields: [
      { path: 'location', label: 'OR room', input: 'entityRef', entityType: 'location', required: true },
      { path: 'name', label: 'Room name', input: 'text', required: true, default: 'OR-3' },
    ],
    build: (v, facility) => {
      const locKey = s(v, 'location');
      const loc = findEntity(facility, 'location', locKey);
      const facilityId = loc?.facilityId ?? facility.facilityId;
      const payload = locationPayload({ facilityId, id: locKey || 'OR-3', name: s(v, 'name', 'OR-3'), status: 'inactive' });
      const entity: SimEntity = { kind: 'location', key: locKey || 'OR-3', system: LOC_SYS, label: `${s(v, 'name', 'OR-3')} — Operating Room (inactive)`, values: v, facilityId };
      return { kind: 'rest', method: 'POST', endpoint: '/Location', payload, entity };
    },
  },
  {
    id: 'sched-shift-hours',
    ucRef: 'OR Schedule · UC10',
    track: 'schedule',
    stage: 'Maintain slots, rooms & horizon',
    title: 'Modify shift operating hours',
    summary: 'Change a schedule’s operating hours.',
    targetProfiles: ['Schedule'],
    extensions: ['HoursOfOperation', 'HoursOfOperationAdjustment'],
    fields: [
      { path: 'schedule', label: 'Schedule', input: 'entityRef', entityType: 'schedule', required: true },
      { path: 'startTime', label: 'New start time', input: 'time', default: '08:00:00' },
      { path: 'stopTime', label: 'New stop time', input: 'time', default: '16:00:00' },
      { path: 'daysOfWeek', label: 'Days of week', input: 'text', default: 'Mon-Fri' },
      { path: 'horizonStart', label: 'Horizon start', input: 'datetime', required: true, default: '2025-06-02T08:00:00-04:00' },
      { path: 'horizonEnd', label: 'Horizon end', input: 'datetime', required: true, default: '2025-06-02T16:00:00-04:00' },
    ],
    build: (v, facility) => {
      const schKey = s(v, 'schedule');
      const sch = findEntity(facility, 'schedule', schKey);
      const facilityId = sch?.facilityId ?? facility.facilityId;
      const payload = schedulePayload({
        facilityId, id: schKey || 'SCH-OR3-2025-06-02', active: true,
        horizonStart: s(v, 'horizonStart'), horizonEnd: s(v, 'horizonEnd'),
        extension: [
          { url: `${SD}/ca-on-seris-ext-hours-of-operation`, extension: [
            { url: 'startTime', valueTime: s(v, 'startTime', '08:00:00') },
            { url: 'stopTime', valueTime: s(v, 'stopTime', '16:00:00') },
            { url: 'daysOfWeek', valueString: s(v, 'daysOfWeek', 'Mon-Fri') },
          ] },
          { url: `${SD}/ca-on-setp-ext-scheduleadjustment`, valueString: 'Hours adjusted' },
        ],
      });
      const entity: SimEntity = { kind: 'schedule', key: schKey || 'SCH-OR3-2025-06-02', system: SCH_SYS, label: `Schedule ${schKey || 'SCH-OR3-2025-06-02'} (hours updated)`, values: v, facilityId, refs: sch?.refs };
      return { kind: 'rest', method: 'POST', endpoint: '/Schedule', payload, entity };
    },
  },
  {
    id: 'sched-horizon',
    ucRef: 'OR Schedule · UC13',
    track: 'schedule',
    stage: 'Maintain slots, rooms & horizon',
    title: 'Update the planning horizon',
    summary: 'Extend or modify the scheduling window.',
    targetProfiles: ['Schedule'],
    extensions: ['SETPScheduleWeek'],
    fields: [
      { path: 'schedule', label: 'Schedule', input: 'entityRef', entityType: 'schedule', required: true },
      { path: 'horizonStart', label: 'Horizon start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'horizonEnd', label: 'Horizon end', input: 'datetime', required: true, default: '2025-06-30T15:30:00-04:00' },
    ],
    build: (v, facility) => {
      const schKey = s(v, 'schedule');
      const sch = findEntity(facility, 'schedule', schKey);
      const facilityId = sch?.facilityId ?? facility.facilityId;
      const payload = schedulePayload({
        facilityId, id: schKey || 'SCH-OR3-2025-06-02', active: true,
        horizonStart: s(v, 'horizonStart'), horizonEnd: s(v, 'horizonEnd'),
        extension: [{ url: `${SD}/ca-on-setp-ext-scheduleweek`, valueString: 'Week extended' }],
      });
      const entity: SimEntity = { kind: 'schedule', key: schKey || 'SCH-OR3-2025-06-02', system: SCH_SYS, label: `Schedule ${schKey || 'SCH-OR3-2025-06-02'} (horizon updated)`, values: v, facilityId, refs: sch?.refs };
      return { kind: 'rest', method: 'POST', endpoint: '/Schedule', payload, entity };
    },
  },
  {
    id: 'sched-close',
    ucRef: 'OR Schedule · UC7',
    track: 'schedule',
    stage: 'Closures',
    title: 'Close an OR schedule',
    summary: 'Inactivate a schedule by shortening its planning horizon.',
    targetProfiles: ['Schedule'],
    fields: [
      { path: 'schedule', label: 'Schedule', input: 'entityRef', entityType: 'schedule', required: true },
      { path: 'horizonStart', label: 'Horizon start', input: 'datetime', required: true, default: '2025-06-02T07:30:00-04:00' },
      { path: 'horizonEnd', label: 'New (earlier) horizon end', input: 'datetime', required: true, default: '2025-06-02T11:30:00-04:00' },
    ],
    build: (v, facility) => {
      const schKey = s(v, 'schedule');
      const sch = findEntity(facility, 'schedule', schKey);
      const facilityId = sch?.facilityId ?? facility.facilityId;
      const payload = schedulePayload({
        facilityId, id: schKey || 'SCH-OR3-2025-06-02', active: false,
        horizonStart: s(v, 'horizonStart'), horizonEnd: s(v, 'horizonEnd'),
      });
      const entity: SimEntity = { kind: 'schedule', key: schKey || 'SCH-OR3-2025-06-02', system: SCH_SYS, label: `Schedule ${schKey || 'SCH-OR3-2025-06-02'} (closed)`, values: v, facilityId, refs: sch?.refs };
      return { kind: 'rest', method: 'POST', endpoint: '/Schedule', payload, entity };
    },
  },
];
