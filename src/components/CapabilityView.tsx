import type { CapabilityStatementDef } from '../fhir/types';
import type { Selection } from '../fhir/spec';
import { profileNames } from '../fhir/spec';
import { ConnectivityGuide } from './ConnectivityGuide';

interface Props {
  capability: CapabilityStatementDef;
  onNavigate: (sel: Selection) => void;
}

/** Renders a CapabilityStatement's REST resources and their interactions. */
export function CapabilityView({ capability, onNavigate }: Props) {
  return (
    <div className="capability">
      {capability.mode && (
        <p className="capability__mode">
          REST mode: <strong>{capability.mode}</strong>
        </p>
      )}
      {capability.resources.length === 0 ? (
        <p className="empty">No REST resources declared.</p>
      ) : (
        <table className="capability-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Profile</th>
              <th>Interactions</th>
            </tr>
          </thead>
          <tbody>
            {capability.resources.map((r) => (
              <tr key={r.type}>
                <td>
                  <code>{r.type}</code>
                </td>
                <td>
                  {r.profile && profileNames.has(r.profile) ? (
                    <button
                      type="button"
                      className="ref-chip"
                      onClick={() => onNavigate({ kind: 'profile', name: r.profile! })}
                    >
                      {r.profile} →
                    </button>
                  ) : (
                    r.profile
                  )}
                </td>
                <td className="capability-table__interactions">
                  {r.interactions.map((i) => (
                    <span key={i} className="badge badge--type">
                      {i}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConnectivityGuide />
    </div>
  );
}
