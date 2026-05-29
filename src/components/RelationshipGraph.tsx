import { useMemo } from 'react';
import { getReferenceEdges } from '../fhir/data';

interface Props {
  /** The resource placed at the centre of the graph. */
  focus: string;
  onNavigate: (name: string) => void;
}

interface Node {
  name: string;
  x: number;
  y: number;
  direction: 'focus' | 'outgoing' | 'incoming';
}

const WIDTH = 720;
const HEIGHT = 480;
const RADIUS = 170;

/**
 * A radial diagram showing how the focused resource references, and is
 * referenced by, other curated resources. Outgoing references fan out to the
 * right, incoming to the left.
 */
export function RelationshipGraph({ focus, onNavigate }: Props) {
  const { nodes, edges } = useMemo(() => buildGraph(focus), [focus]);
  const nodeByName = Object.fromEntries(nodes.map((n) => [n.name, n]));

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Relationships for ${focus}`}>
        {edges.map((e) => {
          const from = nodeByName[e.from];
          const to = nodeByName[e.to];
          if (!from || !to) return null;
          return (
            <g key={`${e.from}->${e.to}:${e.via}`}>
              <line
                className="graph__edge"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd="url(#arrow)"
              />
            </g>
          );
        })}

        {nodes.map((n) => (
          <g
            key={n.name}
            className={`graph__node graph__node--${n.direction}`}
            transform={`translate(${n.x}, ${n.y})`}
            onClick={() => onNavigate(n.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') onNavigate(n.name);
            }}
          >
            <rect x={-58} y={-18} width={116} height={36} rx={18} />
            <text textAnchor="middle" dominantBaseline="central">
              {n.name}
            </text>
          </g>
        ))}

        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph__arrow" />
          </marker>
        </defs>
      </svg>

      <p className="graph__legend">
        <span className="graph__legend-item graph__legend-item--outgoing">outgoing</span>
        {focus} references these&nbsp;·&nbsp;
        <span className="graph__legend-item graph__legend-item--incoming">incoming</span>
        these reference {focus}
      </p>
    </div>
  );
}

function buildGraph(focus: string) {
  const allEdges = getReferenceEdges();
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Distinct neighbours, split by direction relative to the focus.
  const outgoing = unique(allEdges.filter((e) => e.from === focus && e.to !== focus).map((e) => e.to));
  const incoming = unique(allEdges.filter((e) => e.to === focus && e.from !== focus).map((e) => e.from));

  const nodes: Node[] = [{ name: focus, x: cx, y: cy, direction: 'focus' }];

  placeArc(outgoing, -60, 60, RADIUS, cx, cy).forEach((p, i) =>
    nodes.push({ name: outgoing[i], x: p.x, y: p.y, direction: 'outgoing' }),
  );
  placeArc(incoming, 120, 240, RADIUS, cx, cy).forEach((p, i) =>
    nodes.push({ name: incoming[i], x: p.x, y: p.y, direction: 'incoming' }),
  );

  const present = new Set(nodes.map((n) => n.name));
  const edges = allEdges.filter((e) => present.has(e.from) && present.has(e.to));
  return { nodes, edges };
}

/** Evenly distribute points along an arc (degrees) around a centre. */
function placeArc(items: string[], startDeg: number, endDeg: number, r: number, cx: number, cy: number) {
  if (items.length === 0) return [];
  return items.map((_, i) => {
    const t = items.length === 1 ? 0.5 : i / (items.length - 1);
    const deg = startDeg + (endDeg - startDeg) * t;
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}
