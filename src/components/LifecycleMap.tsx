// An interactive-ish diagram of the OR Case lifecycle, promoting the implicit
// Encounter business-status state machine to a first-class explanatory view.

interface State {
  id: string;
  label: string;
  x: number;
  y: number;
}
interface Transition {
  from: string;
  to: string;
  label: string;
}

const W = 720;
const H = 360;

const STATES: State[] = [
  { id: 'booked', label: 'booked', x: 140, y: 180 },
  { id: 'performed', label: 'performed', x: 540, y: 80 },
  { id: 'cancelled', label: 'cancelled', x: 540, y: 200 },
  { id: 'entered-in-error', label: 'entered-in-error', x: 540, y: 310 },
];
const TRANSITIONS: Transition[] = [
  { from: 'booked', to: 'performed', label: 'Record performed (UC3)' },
  { from: 'booked', to: 'cancelled', label: 'Cancel (UC5)' },
  { from: 'booked', to: 'entered-in-error', label: 'Mark in error (UC8)' },
];

export function LifecycleMap() {
  const byId = Object.fromEntries(STATES.map((s) => [s.id, s]));

  return (
    <div className="lifecycle">
      <p className="scenario__summary">
        A surgical case is modelled as a FHIR <code>Encounter</code> whose SERIS{' '}
        <code>businessStatus</code> moves through these states. Add-on cases (UC6 / UC7) enter
        directly at <em>performed</em> or <em>cancelled</em> with no prior booking.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="OR Case lifecycle state machine" className="lifecycle__svg">
        {TRANSITIONS.map((t) => {
          const a = byId[t.from];
          const b = byId[t.to];
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          return (
            <g key={`${t.from}-${t.to}`}>
              <line x1={a.x + 56} y1={a.y} x2={b.x - 64} y2={b.y} className="lifecycle__edge" markerEnd="url(#lc-arrow)" />
              <text x={midX} y={midY - 6} textAnchor="middle" className="lifecycle__edgelabel">
                {t.label}
              </text>
            </g>
          );
        })}
        {STATES.map((s) => (
          <g key={s.id} transform={`translate(${s.x},${s.y})`} className={`lifecycle__node lifecycle__node--${s.id}`}>
            <rect x={-64} y={-20} width={128} height={40} rx={20} />
            <text textAnchor="middle" dominantBaseline="central">
              {s.label}
            </text>
          </g>
        ))}
        <defs>
          <marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph__arrow" />
          </marker>
        </defs>
      </svg>

      <ul className="sr-only">
        {TRANSITIONS.map((t) => (
          <li key={`${t.from}-${t.to}`}>
            {t.from} → {t.to} on {t.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
