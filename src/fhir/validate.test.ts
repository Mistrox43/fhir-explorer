import { describe, it, expect } from 'vitest';
import { ORIENTATION } from '../orientation';
import { SPEC } from './spec';
import { validateResource } from './validate';
import { inspectBundle } from './bundle';
import { assembleMessage, MESSAGE_EVENTS } from './assemble';

// Trust guardrail: every hand-authored example payload the app tells users to
// copy must conform (no ERROR findings) to its SERIS profile, using the same
// checker the UI exposes. This catches drift if the package or examples change.

const stepsWithExamples = ORIENTATION.tracks
  .flatMap((t) => t.steps)
  .filter((s) => s.example);

describe('bundled orientation examples conform to their SERIS profile', () => {
  for (const step of stepsWithExamples) {
    it(`${step.id} — ${step.example!.title}`, () => {
      const r = validateResource(step.example!.json);
      expect(r.matchedBy, 'example should match a SERIS profile').not.toBe('none');
      const errors = r.findings.filter((f) => f.severity === 'error');
      const detail = errors.map((e) => `${e.path}: ${e.message}`).join('\n  ');
      expect(errors, `unexpected conformance errors:\n  ${detail}`).toHaveLength(0);
    });
  }
});

describe('assembled message Bundles pass the inspector with no errors', () => {
  for (const ev of MESSAGE_EVENTS) {
    it(`${ev.code} message`, () => {
      const bundle = assembleMessage(ev.code);
      expect(bundle, 'assembler should produce a bundle').toBeTruthy();
      const r = inspectBundle(bundle);
      const errs = [
        ...r.structural.filter((f) => f.severity === 'error').map((f) => `${f.path}: ${f.message}`),
        ...r.entries.flatMap((e) =>
          e.validation.findings
            .filter((f) => f.severity === 'error')
            .map((f) => `entry ${e.index} (${e.resourceType}) ${f.path}: ${f.message}`),
        ),
      ];
      expect(errs, `inspector errors:\n  ${errs.join('\n  ')}`).toHaveLength(0);
      expect(r.danglingRefs, 'no dangling references').toHaveLength(0);
    });
  }
});

describe('every profile has a template that resolves its profile', () => {
  // Templates are deliberately skeletons (placeholder values), so they are NOT
  // expected to be error-free — but they must at least carry a resolvable
  // meta.profile so "Validate this" checks against the right profile.
  for (const p of SPEC.profiles) {
    it(`${p.name} template`, () => {
      const r = validateResource(p.template?.json);
      expect(r.profileName).toBe(p.name);
    });
  }
});
