import { useMemo, useState } from 'react';
import { validateResource } from '../fhir/validate';
import type { Finding, Severity, ValidationResult } from '../fhir/validate';
import { SPEC } from '../fhir/spec';

interface Props {
  /**
   * A payload pushed in from elsewhere (e.g. "Validate this" on an example).
   * The parent remounts this component (via a key on seed.nonce) so the seed is
   * picked up as fresh initial state — no syncing effect needed.
   */
  seed?: { json: unknown; title?: string; nonce: number };
}

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info', 'pass'];
const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Notes',
  pass: 'Passed',
};

export function ConformanceChecker({ seed }: Props) {
  const [text, setText] = useState(() => (seed ? JSON.stringify(seed.json, null, 2) : ''));
  const [forced, setForced] = useState('');
  const [ran, setRan] = useState(!!seed);
  const [showPass, setShowPass] = useState(false);

  const { result, parseError } = useMemo<{
    result: ValidationResult | null;
    parseError: string | null;
  }>(() => {
    if (!ran) return { result: null, parseError: null };
    try {
      return { result: validateResource(JSON.parse(text), forced || undefined), parseError: null };
    } catch (e) {
      return { result: null, parseError: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [text, forced, ran]);

  const grouped = useMemo(() => {
    const g: Record<Severity, Finding[]> = { error: [], warning: [], info: [], pass: [] };
    result?.findings.forEach((f) => g[f.severity].push(f));
    return g;
  }, [result]);

  return (
    <div className="checker">
      <div className="checker__banner">
        <strong>Structural SERIS-profile check</strong> — not a full FHIR R4 validator. It checks
        what the SERIS profiles assert (cardinality, must-support, fixed values, value-set bindings)
        and is explicit about what it can&rsquo;t see.
      </div>
      <p className="checker__privacy">
        🔒 Everything runs in your browser — nothing is uploaded and the input is cleared when you
        leave. Please paste de-identified (HTEST) data.
      </p>

      <div className="checker__input">
        <div className="checker__toolbar">
          <label>
            Validate against:{' '}
            <select value={forced} onChange={(e) => setForced(e.target.value)}>
              <option value="">Auto-detect (meta.profile / resourceType)</option>
              {SPEC.profiles.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="checker__buttons">
            <button type="button" className="json-action json-action--accent" onClick={() => setRan(true)}>
              Validate
            </button>
            <button
              type="button"
              className="json-action"
              onClick={() => {
                setText('');
                setRan(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          className="checker__textarea"
          placeholder="Paste a FHIR resource (or Bundle) as JSON…"
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          aria-label="Resource JSON to validate"
        />
      </div>

      {parseError && <p className="checker__error">JSON parse error: {parseError}</p>}

      {result && (
        <div className="checker__results" aria-live="polite">
          <div className="checker__summary">
            <span className={`chip chip--${result.ok ? 'pass' : 'error'}`}>
              {result.ok ? 'No errors' : `${result.counts.error} error(s)`}
            </span>
            <span className="checker__matched">
              {result.profileName
                ? `Checked against ${result.profileName} (${result.matchedBy})`
                : 'No SERIS profile matched'}
            </span>
            <span className="checker__tallies">
              {result.counts.warning} warning · {result.counts.info} note · {result.counts.pass} passed
            </span>
          </div>

          {SEVERITY_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            if (sev === 'pass' && !showPass) {
              return (
                <button key="pass" type="button" className="checker__showpass" onClick={() => setShowPass(true)}>
                  Show {items.length} passed check{items.length === 1 ? '' : 's'} ▾
                </button>
              );
            }
            return (
              <section key={sev} className="checker__group">
                <h4 className={`checker__grouptitle checker__grouptitle--${sev}`}>{SEVERITY_LABEL[sev]}</h4>
                <ul>
                  {items.map((f, i) => (
                    <li key={`${sev}-${i}`} className={`finding finding--${sev}`}>
                      <code className="finding__path">{f.path}</code>
                      <span className="finding__msg">{f.message}</span>
                      {f.provenance === 'not-checked' && <span className="finding__prov">not checked</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
