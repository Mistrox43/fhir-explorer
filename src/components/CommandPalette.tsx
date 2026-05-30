import { useEffect, useMemo, useRef, useState } from 'react';
import { search } from '../fhir/searchIndex';
import type { SearchEntry } from '../fhir/searchIndex';
import type { Selection } from '../fhir/spec';

interface Props {
  onClose: () => void;
  onOpen: (sel: Selection, anchor?: string) => void;
  onDecode: (code: string) => void;
}

/**
 * Keyboard-first global search overlay (Cmd/Ctrl-K) over the whole IG. The
 * parent mounts it only while open, so it starts with fresh state each time.
 */
export function CommandPalette({ onClose, onOpen, onDecode }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(q), [q]);

  // Focus the input on mount (DOM side-effect only).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onQueryChange(value: string) {
    setQ(value);
    setActive(0);
  }

  function choose(e?: SearchEntry) {
    if (!e) return;
    if (e.code) onDecode(e.code);
    else onOpen(e.selection, e.anchor);
    onClose();
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape') onClose();
    else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choose(results[active]);
    }
  }

  return (
    <div className="palette__backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Search profiles, elements, extensions, value sets, codes…"
          value={q}
          spellCheck={false}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search query"
        />
        <ul className="palette__results" role="listbox">
          {results.map((e, i) => (
            <li
              key={e.key}
              role="option"
              aria-selected={i === active}
              className={`palette__item${i === active ? ' palette__item--active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={() => choose(e)}
            >
              <span className="palette__group">{e.group}</span>
              <span className="palette__label">{e.label}</span>
              {e.sublabel && <span className="palette__sub">{e.sublabel}</span>}
              {e.code && <span className="palette__hint">↵ decode</span>}
            </li>
          ))}
          {q && results.length === 0 && <li className="palette__empty">No matches for “{q}”.</li>}
          {!q && <li className="palette__empty">Type to search the whole implementation guide.</li>}
        </ul>
      </div>
    </div>
  );
}
