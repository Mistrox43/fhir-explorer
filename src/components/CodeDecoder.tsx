import { decodeCode } from '../fhir/decode';
import { profileNames, valueSetByName, codeSystemByName } from '../fhir/spec';
import type { Selection } from '../fhir/spec';

interface Props {
  code: string;
  onClose: () => void;
  onOpen: (sel: Selection, anchor?: string) => void;
}

/** Reverse lookup overlay: what a code means, what binds it, what emits it. */
export function CodeDecoder({ code, onClose, onOpen }: Props) {
  const r = decodeCode(code);

  function open(sel: Selection, anchor?: string) {
    onOpen(sel, anchor);
    onClose();
  }

  return (
    <div className="palette__backdrop" onMouseDown={onClose}>
      <div className="decoder" role="dialog" aria-label={`Decode ${code}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="decoder__head">
          <h3>
            Decode <code>{r.query}</code>
          </h3>
          <button type="button" className="json-action" onClick={onClose}>
            Close
          </button>
        </div>

        {r.matches.length === 0 ? (
          <p className="empty">No code “{r.query}” is defined in this implementation guide.</p>
        ) : (
          <>
            <section className="decoder__section">
              <h4>Meaning</h4>
              <ul className="decoder__list">
                {r.matches.map((m, i) => (
                  <li key={i}>
                    <strong>{m.display ?? '(no display)'}</strong>
                    <span className="decoder__owner">
                      in{' '}
                      <button
                        type="button"
                        className="ref-chip"
                        onClick={() =>
                          open(
                            { kind: m.ownerKind, name: m.owner },
                            m.ownerKind === 'valueSet' || m.ownerKind === 'codeSystem' ? m.code : undefined,
                          )
                        }
                        disabled={!(valueSetByName.has(m.owner) || codeSystemByName.has(m.owner))}
                      >
                        {m.owner} →
                      </button>
                    </span>
                    {m.system && <code className="decoder__system">{m.system}</code>}
                  </li>
                ))}
              </ul>
            </section>

            <section className="decoder__section">
              <h4>Bound by {r.bindings.length} element(s)</h4>
              {r.bindings.length === 0 ? (
                <p className="decoder__none">No SERIS profile element binds a value set containing this code.</p>
              ) : (
                <ul className="decoder__list">
                  {r.bindings.map((b, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="ref-chip"
                        onClick={() => open({ kind: 'profile', name: b.profile }, b.elementId)}
                        disabled={!profileNames.has(b.profile)}
                      >
                        {b.elementId} →
                      </button>
                      <span className={`badge badge--binding badge--binding-${b.strength}`}>{b.strength}</span>
                      <span className="decoder__via">via {b.valueSet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {r.steps.length > 0 && (
              <section className="decoder__section">
                <h4>Emitted by business event(s)</h4>
                <ul className="decoder__list">
                  {r.steps.map((s, i) => (
                    <li key={i}>
                      <strong>{s.title}</strong>
                      {s.ucRef && <span className="ostep__uc">{s.ucRef}</span>}
                      <span className="decoder__via">via {s.valueSet}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
