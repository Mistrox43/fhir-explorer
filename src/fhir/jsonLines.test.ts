import { describe, it, expect } from 'vitest';
import { buildJsonLines } from './jsonLines';
import { assembleMessage } from './assemble';

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
