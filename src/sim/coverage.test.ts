import { describe, it, expect } from 'vitest';
import { ACTIVITIES } from './activities';
import { sampleFacility } from './state';
import type { FacilityState } from './state';
import type { ActivityDef } from './types';
import { validateResource } from '../fhir/validate';
import { inspectBundle } from '../fhir/bundle';

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
