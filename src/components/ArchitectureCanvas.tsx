import { useState } from 'react';
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
  return { x: mx, y: my };
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
  const [zoom, setZoom] = useState(1);
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
    <div className="canvas-wrapper">
      <svg
        className="arch-svg"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          transition: 'transform 0.12s ease-out',
        }}
        role="group"
        aria-label="FlashCart architecture: browser through checkout, then product and order databases, with an async invoice path"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="edge-arrow" />
          </marker>
        </defs>

        {/* Sync Lane Header */}
        <g className="lane-header sync-lane">
          <rect x="28" y="18" width="5" height="16" fill="var(--primary)" />
          <text className="lane-title" x="42" y="31">
            SYNC PATH — PLACE ORDER
          </text>
          <line x1="28" y1="42" x2={CANVAS_W - 28} y2="42" className="lane-divider" />
        </g>

        {/* Async Lane Header */}
        <g className="lane-header async-lane">
          <rect x="28" y="342" width="5" height="16" fill="var(--secondary)" />
          <text className="lane-title" x="42" y="355">
            ASYNC PATH — POST-ORDER PROCESSING
          </text>
          <line x1="28" y1="366" x2={CANVAS_W - 28} y2="366" className="lane-divider" />
        </g>

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
              <rect className="node-card" width={NODE_W} height={NODE_H} rx="0" />
              <rect className="node-icon" x="12" y="14" width="46" height="46" rx="0" fill={color} />
              <svg x="23" y="25" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <NodeGlyphPaths kind={c.kind} />
              </svg>
              <text className="node-name" x="68" y="36">
                {c.name}
              </text>
              <text className="node-cap" x="68" y="56">
                {cap}
              </text>
              {m ? (
                <rect
                  className="node-util"
                  x="12"
                  y={NODE_H - 7}
                  width={Math.max(4, (NODE_W - 24) * bar)}
                  height="3.5"
                  rx="0"
                />
              ) : null}
              <circle className="port" cx="0" cy={NODE_H / 2} r="4" />
              <circle className="port" cx={NODE_W} cy={NODE_H / 2} r="4" />
            </g>
          );
        })}

        {edges.map(({ conn, lab, lp, lit }) => {
          const pillW = Math.max(44, lab.length * 7.5 + 18);
          return (
            <g key={`${conn.id}-label`} className={lit ? '' : 'edge-dim'}>
              <rect
                className="edge-pill"
                x={lp.x - pillW / 2}
                y={lp.y - 10}
                width={pillW}
                height={20}
                rx="0"
              />
              <text className="edge-label" x={lp.x} y={lp.y + 4} textAnchor="middle">
                {lab}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="canvas-zoom-controls" role="toolbar" aria-label="Canvas Zoom Controls">
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button
          type="button"
          className="zoom-btn zoom-level"
          onClick={() => setZoom(1)}
          title="Reset Zoom to 100%"
          aria-label="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
