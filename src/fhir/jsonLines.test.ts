import { describe, it, expect } from 'vitest';
import { buildJsonLines, buildCards } from './jsonLines';
import { assembleMessage, messageAnnotations, MESSAGE_EVENTS } from './assemble';
import { ORIENTATION } from '../orientation';
import { SCHEDULE_CREATES } from './scheduleRest';

describe('buildJsonLines', () => {
  const samples: { name: string; value: unknown }[] = [
    { name: 'mixed', value: { a: 1, b: { c: 2 }, d: [1, 2, { e: 'x"y' }], f: true, g: null, h: [] } },
    { name: 'scheduled message', value: assembleMessage('case-scheduled') },
    { name: 'performed message', value: assembleMessage('case-performed') },
  ];

  it('reproduces JSON.stringify(value, null, 2) exactly', () => {
    for (const s of samples) {
      const { lines } = buildJsonLines(s.value);
      expect(lines.join('\n'), s.name).toBe(JSON.stringify(s.value, null, 2));
    }
  });

  it('maps nested object + array paths to the correct line ranges', () => {
    const { lines, ranges } = buildJsonLines({ a: 1, b: { c: 2 } });
    const b = ranges.get('b')!;
    expect(lines[b[0]]).toContain('"b": {');
    expect(lines[b[1]].trim()).toBe('}');
    const c = ranges.get('b.c')!;
    expect(c[0]).toBe(c[1]);
    expect(lines[c[0]]).toContain('"c": 2');
  });

  it('maps each entry[i] of the assembled message to the lines of that resource', () => {
    const msg = assembleMessage('case-scheduled');
    const { lines, ranges } = buildJsonLines(msg);
    const header = ranges.get('entry[0]');
    expect(header, 'entry[0] should resolve').toBeTruthy();
    expect(lines.slice(header![0], header![1] + 1).join('\n')).toContain('MessageHeader');
    // entry[7] is the Procedure in every case message.
    const proc = ranges.get('entry[7]');
    expect(lines.slice(proc![0], proc![1] + 1).join('\n')).toContain('Procedure');
  });
});

describe('buildCards fills top-level gaps consistently', () => {
  it('adds a card for every top-level key, keeps hand notes, follows JSON order', () => {
    const json = {
      resourceType: 'Slot',
      meta: {},
      extension: [],
      identifier: [{ value: 'x' }],
      status: 'free',
      schedule: { identifier: { value: 'S' } },
    };
    const hand = [
      { path: 'status', note: 'free = bookable' },
      { path: 'schedule.identifier', note: 'parent schedule' },
    ];
    const cards = buildCards(json, hand);
    const paths = cards.map((c) => c.path);

    for (const k of Object.keys(json)) expect(paths, `missing ${k}`).toContain(k);
    expect(cards.find((c) => c.path === 'status')?.note).toBe('free = bookable');
    expect(cards.find((c) => c.path === 'status')?.auto).toBeFalsy();
    expect(cards.find((c) => c.path === 'meta')?.auto).toBe(true);
    // nested hand card kept and grouped after its parent key
    expect(paths.indexOf('schedule')).toBeLessThan(paths.indexOf('schedule.identifier'));
    // top-level cards follow JSON key order
    expect(paths.filter((p) => p in json)).toEqual(Object.keys(json));
  });

  it('is a no-op when annotations already cover every top-level key (message)', () => {
    const msg = assembleMessage('case-performed');
    const cards = buildCards(msg, messageAnnotations('case-performed'));
    expect(cards.map((c) => c.path)).toEqual(messageAnnotations('case-performed').map((a) => a.path));
    expect(cards.every((c) => !c.auto)).toBe(true);
  });

  it('makes every OR Schedule REST create and orientation example gap-free', () => {
    const examples: { id: string; json: unknown; annotations: { path: string; note: string }[] }[] = [
      ...SCHEDULE_CREATES.map((c) => ({ id: c.id, json: c.resource, annotations: c.annotations })),
      ...ORIENTATION.tracks
        .flatMap((t) => t.steps)
        .filter((s) => s.example)
        .map((s) => ({ id: s.id, json: s.example!.json, annotations: s.example!.annotations })),
    ];
    for (const ex of examples) {
      const { ranges } = buildJsonLines(ex.json);
      const cards = buildCards(ex.json, ex.annotations);
      const cardPaths = new Set(cards.map((c) => c.path));
      for (const key of Object.keys(ex.json as Record<string, unknown>)) {
        expect(cardPaths.has(key), `${ex.id}: no card for "${key}"`).toBe(true);
      }
      // every card resolves to a real slice of the JSON
      for (const c of cards) {
        expect(ranges.has(c.path), `${ex.id}: card "${c.path}" does not resolve`).toBe(true);
      }
    }
  });
});

describe('message descriptor cards leave no gaps', () => {
  for (const ev of MESSAGE_EVENTS) {
    it(`${ev.code}: every top-level section has a resolvable card`, () => {
      const bundle = assembleMessage(ev.code) as Record<string, unknown>;
      const { ranges } = buildJsonLines(bundle);
      const cards = messageAnnotations(ev.code);
      const cardPaths = new Set(cards.map((c) => c.path));

      // Every top-level key of the message has a card pointing at it.
      for (const key of Object.keys(bundle)) {
        expect(cardPaths.has(key), `no card for top-level "${key}"`).toBe(true);
      }
      // Every card resolves to a real slice of the JSON (no dead cards).
      for (const c of cards) {
        expect(ranges.has(c.path), `card "${c.path}" does not resolve`).toBe(true);
      }
    });
  }
});
