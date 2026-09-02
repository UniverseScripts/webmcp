import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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
        <div>
          <h1>Executable ArchitectureLab</h1>
          <p>
            {summary.name} · {summary.profile} · revision <strong>{summary.revision}</strong>
            {IS_FIXTURE && <span className="fixture-tag">fixture data</span>}
            <span className={supported ? 'webmcp-pill on' : 'webmcp-pill off'}>
              {supported ? 'WebMCP ready' : 'WebMCP unavailable'}
            </span>
          </p>
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
