import { useEffect, useMemo, useRef, useState } from 'react';
import type { TemplateExample } from '../fhir/types';
import { buildJsonLines, buildCards } from '../fhir/jsonLines';
import { JsonActions } from './JsonActions';

interface Props {
  example?: TemplateExample;
  /** When provided, shows a "Validate this" action that runs the payload through the checker. */
  onValidate?: (json: unknown, title?: string) => void;
}

/**
 * Shows a (generated) example payload alongside descriptor cards. Each card is
 * keyed by a JSON path; hovering previews and clicking pins a highlight on the
 * exact slice of JSON it describes, scrolling it into view — so you can see the
 * part of the message a given resource or business concept maps to.
 */
export function ExampleViewer({ example, onValidate }: Props) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [prevJson, setPrevJson] = useState(example?.json);
  const preRef = useRef<HTMLPreElement>(null);

  const { lines, ranges } = useMemo(() => buildJsonLines(example?.json), [example?.json]);
  // Merge hand-authored notes with auto-filled cards so every top-level section
  // of the JSON is clickable (no gaps), consistently across every example.
  const cards = useMemo(
    () => buildCards(example?.json, example?.annotations ?? []),
    [example?.json, example?.annotations],
  );

  // Clear any selection when the example itself changes (adjust state during
  // render, per React guidance, rather than in an effect).
  if (example?.json !== prevJson) {
    setPrevJson(example?.json);
    setPinned(null);
    setHovered(null);
  }

  // When a card is pinned, scroll its slice into view inside the code panel only
  // (so the cards stay put).
  useEffect(() => {
    if (!pinned || !preRef.current) return;
    const range = ranges.get(pinned);
    if (!range) return;
    const el = preRef.current.querySelector<HTMLElement>(`[data-line="${range[0]}"]`);
    if (!el) return;
    const pre = preRef.current;
    const target = el.offsetTop - pre.clientHeight / 2 + el.offsetHeight / 2;
    pre.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [pinned, ranges]);

  if (!example) return <p className="empty">No template available for this profile.</p>;
  const filename = `${(example.title || 'example').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;

  const shownPath = hovered ?? pinned;
  const shownRange = shownPath ? ranges.get(shownPath) : undefined;

  return (
    <article className="example">
      <div className="example__head">
        <p className="example__desc">{example.description}</p>
        <JsonActions
          json={example.json}
          filename={filename}
          extra={
            onValidate && (
              <button
                type="button"
                className="json-action json-action--accent"
                onClick={() => onValidate(example.json, example.title)}
              >
                Validate this
              </button>
            )
          }
        />
      </div>
      <div className="example__body">
        <pre className="example__code" ref={preRef}>
          {lines.map((line, i) => {
            const hl = shownRange ? i >= shownRange[0] && i <= shownRange[1] : false;
            return (
              <span
                key={i}
                data-line={i}
                className={`example__line${hl ? ' example__line--hl' : ''}`}
              >
                {line || ' '}
              </span>
            );
          })}
        </pre>
        {cards.length > 0 && (
          <div className="example__notescol">
            <p className="example__noteshint">Hover or click a card to highlight it in the JSON.</p>
            <ul className="example__notes" aria-label="Annotations">
              {cards.map((a) => {
                const hasLoc = ranges.has(a.path);
                const isPinned = pinned === a.path;
                return (
                  <li key={a.path}>
                    <button
                      type="button"
                      className={`example__note${isPinned ? ' example__note--active' : ''}${
                        hasLoc ? '' : ' example__note--noloc'
                      }`}
                      onClick={() => hasLoc && setPinned(isPinned ? null : a.path)}
                      onMouseEnter={() => setHovered(a.path)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(a.path)}
                      onBlur={() => setHovered(null)}
                      aria-pressed={hasLoc ? isPinned : undefined}
                    >
                      <code className="example__note-path">
                        {a.path}
                        {hasLoc && (
                          <span className="example__note-jump" aria-hidden="true">
                            {' '}
                            ↦
                          </span>
                        )}
                      </code>
                      {a.note && <span>{a.note}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
