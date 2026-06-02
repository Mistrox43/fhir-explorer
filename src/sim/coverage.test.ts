import { describe, it, expect } from 'vitest';
import { ACTIVITIES, activitiesByTrack } from './activities';
import { sampleFacility } from './state';
import type { FacilityState } from './state';
import type { ActivityDef } from './types';
import { validateResource } from '../fhir/validate';
import { inspectBundle } from '../fhir/bundle';
import { extensionByName, profileByName, valueSetByName } from '../fhir/spec';

// Build each activity with its field defaults (+ a seeded facility for any
// entity references) and assert the generated FHIR is conformant — the same
// dogfood guarantee the Build samples have. The field-vs-spec coverage assertion
// is layered on as the activity set grows.

function defaultValues(activity: ActivityDef, facility: FacilityState): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of activity.fields) {
    if (f.default !== undefined) values[f.path] = f.default;
    else if (f.input === 'entityRef' && f.entityType) {
      const first = facility.entities[f.entityType][0];
      if (first) values[f.path] = first.key;
    } else if (f.input === 'select' && f.valueSet) {
      const vs = valueSetByName.get(f.valueSet);
      const first = vs?.includes.flatMap((inc) => inc.concepts.map((c) => ({ ...c, system: inc.system })))[0];
      if (first) {
        values[f.path] =
          f.shape === 'code'
            ? first.code
            : { coding: [{ system: first.system, code: first.code, display: first.display }] };
      }
    }
  }
  return values;
}

describe('every simulator activity builds a conformant payload', () => {
  for (const activity of ACTIVITIES) {
    it(`${activity.id} — ${activity.title}`, () => {
      const facility = sampleFacility();
      const out = activity.build(defaultValues(activity, facility), facility);
      if (out.kind === 'message') {
        const r = inspectBundle(out.payload);
        const errs = [
          ...r.structural.filter((f) => f.severity === 'error'),
          ...r.entries.flatMap((e) => e.validation.findings.filter((f) => f.severity === 'error')),
        ];
        expect(errs, errs.map((e) => `${e.path}: ${e.message}`).join('\n  ')).toHaveLength(0);
        expect(r.danglingRefs, 'no dangling references').toHaveLength(0);
      } else {
        const r = validateResource(out.payload);
        expect(r.matchedBy, 'output should match a SERIS profile').not.toBe('none');
        const errs = r.findings.filter((f) => f.severity === 'error');
        expect(errs, errs.map((e) => `${e.path}: ${e.message}`).join('\n  ')).toHaveLength(0);
      }
    });
  }
});

// ---- the coverage linchpin: no constrained coded input may be silently missing -

/** Enumerated value sets that should be surfaced as a dropdown by a track. */
function valueSetsToSurface(track: 'schedule' | 'case', profiles: string[]): Set<string> {
  const vss = new Set<string>();
  for (const pn of profiles) {
    const p = profileByName.get(pn);
    for (const el of p?.elements ?? []) {
      if (el.binding?.valueSetName && !el.fixed) vss.add(el.binding.valueSetName);
    }
  }
  // Plus the bindings inside any extension the track's activities declare.
  const exts = new Set(activitiesByTrack(track).flatMap((a) => a.extensions ?? []));
  for (const en of exts) {
    const ext = extensionByName.get(en);
    for (const el of ext?.elements ?? []) {
      if (el.binding?.valueSetName && !el.fixed) vss.add(el.binding.valueSetName);
    }
  }
  // Only enumerated value sets can be dropdowns; skip external/fixed-only ones.
  return new Set(
    [...vss].filter((vs) => {
      const v = valueSetByName.get(vs);
      return v && v.includes.some((inc) => inc.concepts.length > 0);
    }),
  );
}

// v3-ServiceDeliveryLocationRoleType is bound on Location.type, which SERIS fixes
// to "OR" — auto-applied by the builder, not a user input.
const AUTO_VALUE_SETS = new Set(['v3-ServiceDeliveryLocationRoleType']);

describe('simulator activities declare valid artifacts', () => {
  for (const a of ACTIVITIES) {
    it(`${a.id}: extensions + field value sets resolve`, () => {
      for (const ext of a.extensions ?? []) {
        expect(extensionByName.has(ext), `unknown extension "${ext}"`).toBe(true);
      }
      for (const f of a.fields) {
        if (f.valueSet) expect(valueSetByName.has(f.valueSet), `unknown value set "${f.valueSet}"`).toBe(true);
        expect(a.targetProfiles.length, 'activity targets a profile').toBeGreaterThan(0);
      }
    });
  }
});

describe('OR Schedule surfaces every coded input as a dropdown (no gaps)', () => {
  it('every bound, enumerated value set on the schedule profiles/extensions has a select field', () => {
    const surfaced = new Set(
      activitiesByTrack('schedule')
        .flatMap((a) => a.fields)
        .filter((f) => f.valueSet)
        .map((f) => f.valueSet as string),
    );
    const required = [...valueSetsToSurface('schedule', ['Location', 'Schedule', 'Slot'])].filter(
      (vs) => !AUTO_VALUE_SETS.has(vs),
    );
    const missing = required.filter((vs) => !surfaced.has(vs));
    expect(missing, `value sets not surfaced as dropdowns: ${missing.join(', ')}`).toHaveLength(0);
  });
});
