import type { ComponentMetric, Mode, Protocol } from '../contracts';
import type { FixtureComponent, FixtureConnection } from '../contracts/fixture/graph';
import { CANVAS_H, CANVAS_W, NODE_H, NODE_W, nodeCenter, nodePosition } from './canvasLayout';

export interface ArchitectureCanvasProps {
  components: FixtureComponent[];
  connections: FixtureConnection[];
  selectedIds: Set<string>;
  inspectId: string | null;
  metrics: ComponentMetric[] | null;
  animatePackets: boolean;
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
  const dx = Math.max(48, Math.abs(to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function protoLabel(protocol: Protocol, mode: Mode): string {
  return mode === 'async' ? `${protocol} · async` : protocol;
}

export function ArchitectureCanvas({
  components,
  connections,
  selectedIds,
  inspectId,
  metrics,
  animatePackets,
  onInspect,
  onToggleSelect,
}: ArchitectureCanvasProps) {
  const indexOf = (id: string): number => components.findIndex((c) => c.id === id);
  const hasSelection = selectedIds.size > 0;

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

      <text className="lane-label" x="24" y="28">
        Sync path — place order
      </text>
      <text className="lane-label" x="24" y="292">
        Async path — after ack
      </text>

      {connections.map((conn) => {
        const fromI = indexOf(conn.from);
        const toI = indexOf(conn.to);
        if (fromI < 0 || toI < 0) return null;
        const a = nodeCenter(conn.from, fromI);
        const b = nodeCenter(conn.to, toI);
        const d = edgePath(a, b);
        const lit =
          !hasSelection || (selectedIds.has(conn.from) && selectedIds.has(conn.to));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8 };
        return (
          <g key={conn.id} className={lit ? '' : 'edge-dim'}>
            <path
              d={d}
              className={`edge ${conn.mode === 'async' ? 'edge-async' : 'edge-sync'}`}
              fill="none"
              markerEnd="url(#arrow)"
            />
            <text className="edge-label" x={mid.x} y={mid.y} textAnchor="middle">
              {protoLabel(conn.protocol, conn.mode)}
            </text>
            {animatePackets && lit && (
              <circle r="4" className="packet">
                <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        );
      })}

      {components.map((c, i) => {
        const p = nodePosition(c.id, i);
        const selected = selectedIds.has(c.id);
        const dim = hasSelection && !selected;
        const m = metrics?.find((x) => x.componentId === c.id);
        const cap =
          c.capacityRps === null ? 'not modelled' : `${c.capacityRps} rps assumed`;
        return (
          <g
            key={c.id}
            className={`arch-node ${heatClass(c, metrics)} ${selected ? 'is-selected' : ''} ${inspectId === c.id ? 'is-inspect' : ''} ${dim ? 'is-dim' : ''}`}
            transform={`translate(${p.x} ${p.y})`}
            tabIndex={0}
            role="button"
            aria-pressed={selected}
            aria-label={`${c.name}, ${c.kind}, ${cap}`}
            onClick={(e) => {
              if (e.shiftKey) onToggleSelect(c.id);
              else onInspect(c.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (e.shiftKey) onToggleSelect(c.id);
                else onInspect(c.id);
              }
            }}
          >
            <rect width={NODE_W} height={NODE_H} rx="10" />
            <text className="node-kind" x="12" y="18">
              {c.kind}
            </text>
            <text className="node-name" x="12" y="38">
              {c.name}
            </text>
            <text className="node-cap" x="12" y="56">
              {m
                ? `${Math.round(m.utilization * 100)}% util · ${Math.round(m.errorRate * 100)}% err`
                : cap}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
