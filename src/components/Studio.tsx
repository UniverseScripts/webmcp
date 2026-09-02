import { useEffect, useRef, useState } from 'react';
import { controls, IS_FIXTURE, lastRun, liveGraph, port } from '../contracts';
import { isSupported } from '../webmcp/adapter';
import type { ToolActivity } from '../webmcp/adapter';
import { ActivityLog } from './ActivityLog';
import { ArchitectureCanvas, type ClickMode } from './ArchitectureCanvas';
import { Inspector } from './Inspector';
import { ProposalDrawer } from './ProposalDrawer';
import { AGENT_PROMPT, SharedContext } from './SharedContext';
import { SimStrip } from './SimStrip';

const DEMO_SCOPE = ['checkout', 'redis', 'product_db'];
const PLACE_ORDER = ['browser', 'cdn', 'gateway', 'checkout', 'redis', 'product_db', 'order_db'];

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort().join(',');
  const right = [...b].sort().join(',');
  return left === right;
}

export function Studio({ activity }: { activity: ToolActivity[] }) {
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [clickMode, setClickMode] = useState<ClickMode>('inspect');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  const supported = isSupported();
  const summary = port.getSummary('brief');
  const selection = port.getSelection();
  const graph = liveGraph();
  const run = lastRun();
  const selectedIds = new Set(selection?.components.map((c) => c.id) ?? []);
  const selectedList = [...selectedIds];
  const inspect = graph.components.find((c) => c.id === inspectId) ?? null;
  const inspectMetric = run?.componentMetrics.find((m) => m.componentId === inspectId);

  const copyPrompt = () => {
    void navigator.clipboard.writeText(AGENT_PROMPT);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) controls.clearSelection();
    else controls.setSelection([...next]);
    setInspectId(id);
  };

  return (
    <div className="studio">
      <header className="studio-top">
        <div className="studio-brand">
          <h1>Executable ArchitectureLab</h1>
        </div>

        <div className="studio-header-right">
          <span className={`webmcp-status-pill ${supported ? 'is-connected' : 'is-disconnected'}`}>
            {supported ? (
              <>
                <svg
                  className="status-icon"
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M13.3334 4L6.00008 11.3333L2.66675 8"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>WebMCP ready</span>
              </>
            ) : (
              <>
                <span className="status-dot off" />
                <span>WebMCP unavailable</span>
              </>
            )}
          </span>

          <div className="info-popover-anchor" ref={infoRef}>
            <button
              type="button"
              className={`info-toggle-btn ${showInfo ? 'is-active' : ''}`}
              onClick={() => setShowInfo((v) => !v)}
              aria-label="System Information"
              title="System Information & Model Details"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>

            {showInfo && (
              <div className="info-popover-card" role="dialog" aria-label="System Information">
                <div className="popover-header">
                  <strong>System Model Info</strong>
                  <button
                    type="button"
                    className="popover-close"
                    onClick={() => setShowInfo(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="popover-row">
                  <span className="popover-label">Architecture</span>
                  <span className="popover-val">{summary.name}</span>
                </div>
                <div className="popover-row">
                  <span className="popover-label">Profile</span>
                  <span className="popover-val">{summary.profile}</span>
                </div>
                <div className="popover-row">
                  <span className="popover-label">Graph Revision</span>
                  <span className="popover-val font-mono">revision {summary.revision}</span>
                </div>
                <div className="popover-row">
                  <span className="popover-label">Data Source</span>
                  <span className="popover-val">
                    {IS_FIXTURE ? (
                      <span className="fixture-badge">Fixture model</span>
                    ) : (
                      'Live domain'
                    )}
                  </span>
                </div>
                <p className="popover-note">
                  Directional queueing approximation for demonstration and safety verification. All numbers are synthetic assumptions.
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {!supported && (
        <div className="banner">
          <strong>Agent collaboration is unavailable in this browser.</strong> The canvas and scenarios still
          work. To let an agent join, open this URL in the ChatGPT desktop app’s browser, or in Chrome 149+ with{' '}
          <code>chrome://flags/#enable-webmcp-testing</code> enabled.
        </div>
      )}

      <div className="studio-body">
        <div className="canvas-pane">
          <div className="canvas-toolbar">
            <div className="mode-toggle" role="radiogroup" aria-label="Canvas click mode">
              <button
                type="button"
                role="radio"
                aria-checked={clickMode === 'inspect'}
                className={clickMode === 'inspect' ? 'primary' : 'ghost'}
                onClick={() => setClickMode('inspect')}
              >
                Inspect
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={clickMode === 'scope'}
                className={clickMode === 'scope' ? 'primary' : 'ghost'}
                onClick={() => setClickMode('scope')}
              >
                Add to scope
              </button>
            </div>
            <button
              type="button"
              className={sameIds(selectedList, DEMO_SCOPE) ? 'ghost is-active' : 'ghost'}
              onClick={() => controls.setSelection(DEMO_SCOPE)}
            >
              Select Checkout → Redis → Product DB
            </button>
            <button
              type="button"
              className={sameIds(selectedList, PLACE_ORDER) ? 'ghost is-active' : 'ghost'}
              onClick={() => controls.setSelection(PLACE_ORDER)}
            >
              Place Order (sync path)
            </button>
            <button type="button" className="ghost" onClick={() => controls.clearSelection()}>
              Clear selection
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                controls.resetToSeed();
                setInspectId(null);
              }}
            >
              Reset to seed
            </button>
          </div>
          <p className="canvas-hint">
            {clickMode === 'inspect'
              ? 'Click a node to inspect it. Use a flow chip or Add to scope to change what the agent can see. Dashed wires are async.'
              : 'Click a node to add or remove it from the agent’s scope. Inspect stays available in the inspector panel. Dashed wires are async.'}
          </p>
          <ArchitectureCanvas
            components={graph.components}
            connections={graph.connections}
            selectedIds={selectedIds}
            inspectId={inspectId}
            metrics={run?.componentMetrics ?? null}
            animatePackets={Boolean(run) && !reduceMotion}
            clickMode={clickMode}
            onInspect={setInspectId}
            onToggleSelect={toggleSelect}
          />
        </div>

        <aside className="studio-rail">
          <SharedContext selection={selection} onCopyPrompt={copyPrompt} />
          <Inspector
            component={inspect}
            metric={inspectMetric}
            inScope={inspectId ? selectedIds.has(inspectId) : false}
            onToggleScope={toggleSelect}
          />
          <ProposalDrawer />
          <ActivityLog activity={activity} />
        </aside>
      </div>

      <SimStrip />

      <p className="footer-hint">
        Tool registry and manual invocation: <a href="/debug">/debug</a>. Every number on this page is a
        synthetic, directional assumption — not a production measurement.
      </p>
    </div>
  );
}
