import { describe, it, expect } from 'vitest';
import { buildJsonLines } from './jsonLines';
import { assembleMessage, messageAnnotations, MESSAGE_EVENTS } from './assemble';

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
