import { useState } from 'react';
import type { Profile, ProfileElement } from '../fhir/types';
import type { Selection } from '../fhir/spec';
import { valueSetByName } from '../fhir/spec';
import { parseComment } from '../fhir/sanitize';

interface Props {
  profile: Profile;
  onNavigate: (sel: Selection, at?: string) => void;
}

/** A "what must I send" view: only the required + must-support elements. */
export function ProfileChecklist({ profile, onNavigate }: Props) {
  const [copied, setCopied] = useState(false);
  const items = profile.elements.filter(
    (el) =>
      ((el.min != null && el.min >= 1) || el.mustSupport) &&
      el.leaf !== 'extension' &&
      el.leaf !== 'modifierExtension',
  );

  if (items.length === 0) {
    return <p className="empty">This profile sets no required or must-support elements.</p>;
  }

  async function copyList() {
    const lines = items.map((el) => {
      const card = `${el.min ?? ''}..${el.max ?? ''}`;
      const flags = [
        el.min ? 'required' : el.mustSupport ? 'must-support' : '',
        el.fixed ? `fixed` : '',
        el.binding ? `${el.binding.strength}:${el.binding.valueSetName ?? ''}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      return `- [ ] ${el.id} (${card})${el.short ? ` — ${el.short}` : ''}${flags ? `  [${flags}]` : ''}`;
    });
    try {
      await navigator.clipboard.writeText(`# ${profile.name} — required & must-support\n${lines.join('\n')}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="checklist">
      <div className="checklist__head">
        <p className="checklist__lead">
          The <strong>{items.length}</strong> required and must-support elements of {profile.name} — what a
          conformant instance needs.
        </p>
        <button type="button" className="json-action" onClick={copyList}>
          {copied ? 'Copied ✓' : 'Copy as list'}
        </button>
      </div>
      <ul className="checklist__items">
        {items.map((el) => (
          <ChecklistRow key={el.id} el={el} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function ChecklistRow({ el, onNavigate }: { el: ProfileElement; onNavigate: (s: Selection, at?: string) => void }) {
  const card = `${el.min ?? ''}..${el.max ?? ''}`;
  const seris = parseComment(el.comment)?.seris;
  return (
    <li className="checklist__row" style={{ marginLeft: (el.depth - 1) * 16 }}>
      <div className="checklist__line">
        <code className="checklist__path">{el.leaf}</code>
        <span className={`badge badge--card${el.min ? ' badge--required' : ''}`}>{card}</span>
        {el.min ? (
          <span className="badge badge--required-tag">required</span>
        ) : (
          <span className="badge badge--ms">S</span>
        )}
        {el.fixed && <span className="badge badge--fixed">fixed</span>}
        {el.binding &&
          (el.binding.valueSetName && valueSetByName.has(el.binding.valueSetName) ? (
            <button
              type="button"
              className="ref-chip"
              onClick={() => onNavigate({ kind: 'valueSet', name: el.binding!.valueSetName! })}
            >
              {el.binding.strength}: {el.binding.valueSetName} →
            </button>
          ) : (
            <span className={`badge badge--binding badge--binding-${el.binding.strength}`}>
              {el.binding.strength}
            </span>
          ))}
      </div>
      {el.short && <p className="checklist__short">{el.short}</p>}
      {seris && (
        <p className="element-row__seris">
          <span className="element-row__seris-tag">SERIS</span>
          {seris}
        </p>
      )}
    </li>
  );
}
