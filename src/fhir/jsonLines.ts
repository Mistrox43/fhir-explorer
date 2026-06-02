// Pretty-prints a JSON value to individual lines while recording, for every
// dotted/bracketed path, the [startLine, endLine] range it occupies. This lets
// the ExampleViewer highlight the exact slice of JSON that a descriptor note
// points at (e.g. clicking the "entry[7]" card highlights the Procedure).
//
// Invariant: lines.join('\n') === JSON.stringify(value, null, 2)
// Path format matches the annotation paths used across the app, e.g.
//   "entry[0]", "schedule.identifier", "meta".

export interface JsonLineMap {
  lines: string[];
  /** path -> inclusive [startLine, endLine] (0-based) range in `lines`. */
  ranges: Map<string, [number, number]>;
}

const INDENT = '  ';

export function buildJsonLines(value: unknown): JsonLineMap {
  const lines: string[] = [];
  const ranges = new Map<string, [number, number]>();

  // Appends the serialization of `val` to `lines`. `prefix` opens the first line
  // (e.g. '"key": ' for object members, '' for array elements / the root);
  // `suffix` closes the last line (a trailing ',' between siblings). Registers
  // the produced line range under `path` (skipped for the root, whose path is '').
  const emit = (val: unknown, depth: number, prefix: string, path: string, suffix: string): void => {
    const pad = INDENT.repeat(depth);
    const start = lines.length;

    if (val === null || typeof val !== 'object') {
      // JSON.stringify renders primitives and escapes strings for us.
      lines.push(pad + prefix + JSON.stringify(val) + suffix);
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(pad + prefix + '[]' + suffix);
      } else {
        lines.push(pad + prefix + '[');
        val.forEach((el, i) => {
          // JSON turns undefined/function array elements into null.
          const safe = el === undefined || typeof el === 'function' ? null : el;
          emit(safe, depth + 1, '', `${path}[${i}]`, i === val.length - 1 ? '' : ',');
        });
        lines.push(pad + ']' + suffix);
      }
    } else {
      const obj = val as Record<string, unknown>;
      // JSON.stringify drops keys whose value is undefined or a function.
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function');
      if (keys.length === 0) {
        lines.push(pad + prefix + '{}' + suffix);
      } else {
        lines.push(pad + prefix + '{');
        keys.forEach((k, i) => {
          const childPath = path ? `${path}.${k}` : k;
          emit(obj[k], depth + 1, `${JSON.stringify(k)}: `, childPath, i === keys.length - 1 ? '' : ',');
        });
        lines.push(pad + '}' + suffix);
      }
    }

    if (path) ranges.set(path, [start, lines.length - 1]);
  };

  emit(value, 0, '', '', '');
  return { lines, ranges };
}
