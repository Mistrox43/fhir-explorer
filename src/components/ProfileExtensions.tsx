import type { ProfileExtensionUse } from '../fhir/types';
import type { Selection } from '../fhir/spec';

interface Props {
  uses: ProfileExtensionUse[];
  onNavigate: (sel: Selection) => void;
}

/**
 * Lists the extensions that target this profile, derived from each extension's
 * declared context. Grouped by the context path they attach to.
 */
export function ProfileExtensions({ uses, onNavigate }: Props) {
  if (uses.length === 0) return null;

  // Group by the element path the extension attaches to.
  const byContext = new Map<string, ProfileExtensionUse[]>();
  for (const u of uses) {
    const list = byContext.get(u.context) ?? [];
    list.push(u);
    byContext.set(u.context, list);
  }

  return (
    <details className="profile-extensions" open>
      <summary>
        Extensions on this profile <span className="resource-group__count">{uses.length}</span>
      </summary>
      {[...byContext.entries()].map(([context, list]) => (
        <div key={context} className="profile-extensions__group">
          <code className="profile-extensions__context">{context}</code>
          <div className="profile-extensions__chips">
            {list.map((u) => (
              <button
                key={u.name}
                type="button"
                className="ref-chip"
                onClick={() => onNavigate({ kind: 'extension', name: u.name })}
              >
                {u.name} →
              </button>
            ))}
          </div>
        </div>
      ))}
    </details>
  );
}
