import type { ComponentMetric, Protocol } from '../contracts';
import type { FixtureComponent, FixtureConnection } from '../contracts/fixture/graph';
import { CANVAS_H, CANVAS_W, NODE_H, NODE_W, nodeCenter, nodePort, nodePosition } from './canvasLayout';
import { formatRps } from './format';
import { kindColor } from './kindVisual';
import { NodeGlyphPaths } from './NodeGlyph';

export type ClickMode = 'inspect' | 'scope';

export interface ArchitectureCanvasProps {
  components: FixtureComponent[];
  connections: FixtureConnection[];
  selectedIds: Set<string>;
  inspectId: string | null;
  metrics: ComponentMetric[] | null;
  animatePackets: boolean;
  clickMode: ClickMode;
  onInspect: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

function heatClass(c: FixtureComponent, metrics: ComponentMetric[] | null): string {
  const m = metrics?.find((x) => x.componentId === c.id);
  if (m) {
    if (m.errorRate > 0.15 || m.utilization > 1) return 'heat-bad';
    if (m.utilization > 0.7 || m.errorRate > 0) return 'heat-warn';
    return 'heat-ok';
  }
  if (c.health === 'down') return 'heat-bad';
  if (c.health === 'degraded') return 'heat-warn';
  return '';
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mid = from.x + dx / 2;
    return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
  }
  const mid = from.y + dy / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`;
}

function protoLabel(protocol: Protocol): string {
  return protocol;
}

function labelPoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  // Sit above the cards, never in the 108px gutter where a pill still collides with ports.
  if (horizontal) return { x: mx, y: Math.min(a.y, b.y) - NODE_H / 2 - 10 };
  return { x: mx + 24, y: my };
}

export function ArchitectureCanvas({
  components,
  connections,
  selectedIds,
  inspectId,
  metrics,
  animatePackets,
  clickMode,
  onInspect,
  onToggleSelect,
}: ArchitectureCanvasProps) {
  const indexOf = (id: string): number => components.findIndex((c) => c.id === id);
  const hasSelection = selectedIds.size > 0;

  const activate = (id: string, additive: boolean) => {
    if (additive || clickMode === 'scope') onToggleSelect(id);
    else onInspect(id);
  };

  const edges = connections.flatMap((conn) => {
    const fromI = indexOf(conn.from);
    const toI = indexOf(conn.to);
    if (fromI < 0 || toI < 0) return [];
    const fromC = nodeCenter(conn.from, fromI);
    const toC = nodeCenter(conn.to, toI);
    const a = nodePort(conn.from, fromI, toC);
    const b = nodePort(conn.to, toI, fromC);
    const lit = !hasSelection || (selectedIds.has(conn.from) && selectedIds.has(conn.to));
    return [
      {
        conn,
        d: edgePath(a, b),
        lit,
        lab: protoLabel(conn.protocol),
        lp: labelPoint(a, b),
      },
    ];
  });

  return (
    <svg
      className="arch-svg"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="group"
      aria-label="FlashCart architecture: browser through checkout, then product and order databases, with an async invoice path"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="edge-arrow" />
        </marker>
      </defs>

      <text className="lane-label" x="28" y="32">
        Sync path — place order
      </text>
      <text className="lane-label" x="28" y="348">
        Async path — after acknowledgement
      </text>

      {edges.map(({ conn, d, lit }) => (
        <g key={conn.id} className={lit ? '' : 'edge-dim'}>
          <path
            d={d}
            className={conn.mode === 'async' ? 'edge-async' : 'edge-sync'}
            fill="none"
            markerEnd="url(#arrow)"
          />
          {animatePackets && lit && (
            <circle r="4" className="packet">
              <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
            </circle>
          )}
        </g>
      ))}

      {components.map((c, i) => {
        const p = nodePosition(c.id, i);
        const selected = selectedIds.has(c.id);
        const dim = hasSelection && !selected;
        const m = metrics?.find((x) => x.componentId === c.id);
        const cap = m
          ? `${Math.round(m.utilization * 100)}% used`
          : formatRps(c.capacityRps);
        const color = kindColor(c.kind);
        const bar = m ? Math.min(1, m.utilization) : 0;
        return (
          <g
            key={c.id}
            className={`arch-node ${heatClass(c, metrics)} ${selected ? 'is-selected' : ''} ${inspectId === c.id ? 'is-inspect' : ''} ${dim ? 'is-dim' : ''}`}
            transform={`translate(${p.x} ${p.y})`}
            tabIndex={0}
            role="button"
            aria-pressed={selected}
            aria-label={`${c.name}, ${c.kind}. Click to ${clickMode === 'scope' ? 'add to agent scope' : 'inspect'}.`}
            onClick={(e) => activate(c.id, e.shiftKey)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(c.id, e.shiftKey);
              }
            }}
          >
            <title>
              {c.name}: click to {clickMode === 'scope' ? 'add to the agent’s scope' : 'inspect'}. Shift-click always
              toggles scope.
            </title>
            <rect className="node-card" width={NODE_W} height={NODE_H} rx="12" />
            <rect className="node-icon" x="10" y="14" width="36" height="36" rx="9" fill={color} />
            <svg x="19" y="23" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <NodeGlyphPaths kind={c.kind} />
            </svg>
            <text className="node-name" x="54" y="30">
              {c.name}
            </text>
            <text className="node-cap" x="54" y="48">
              {cap}
            </text>
            {m ? (
              <rect
                className="node-util"
                x="10"
                y={NODE_H - 8}
                width={Math.max(4, (NODE_W - 20) * bar)}
                height="3"
                rx="1.5"
              />
            ) : null}
            <circle className="port" cx="0" cy={NODE_H / 2} r="4" />
            <circle className="port" cx={NODE_W} cy={NODE_H / 2} r="4" />
          </g>
        );
      })}

      {edges.map(({ conn, lab, lp, lit }) => {
        const pillW = Math.max(40, lab.length * 6.8 + 16);
        return (
          <g key={`${conn.id}-label`} className={lit ? '' : 'edge-dim'}>
            <rect className="edge-pill" x={lp.x - pillW / 2} y={lp.y - 11} width={pillW} height={16} rx="8" />
            <text className="edge-label" x={lp.x} y={lp.y + 1} textAnchor="middle">
              {lab}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
