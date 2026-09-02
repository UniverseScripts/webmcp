import { useEffect, useState } from 'react';
import { controls, IS_FIXTURE, lastRun, liveGraph, port } from '../contracts';
import { isSupported } from '../webmcp/adapter';
import type { ToolActivity } from '../webmcp/adapter';
import { ActivityLog } from './ActivityLog';
import { ArchitectureCanvas } from './ArchitectureCanvas';
import { Inspector } from './Inspector';
import { ProposalDrawer } from './ProposalDrawer';
import { AGENT_PROMPT, SharedContext } from './SharedContext';
import { SimStrip } from './SimStrip';

const DEMO_SCOPE = ['checkout', 'redis', 'product_db'];
const PLACE_ORDER = ['browser', 'cdn', 'gateway', 'checkout', 'redis', 'product_db', 'order_db'];

export function Studio({ activity }: { activity: ToolActivity[] }) {
  const [inspectId, setInspectId] = useState<string | null>(null);
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
            {summary.name} · profile {summary.profile} · revision <strong>{summary.revision}</strong>
            {IS_FIXTURE && <span className="fixture-tag">fixture data</span>}
            <span className={supported ? 'webmcp-pill on' : 'webmcp-pill off'}>
              {supported ? 'WebMCP ready' : 'WebMCP unavailable'}
            </span>
          </p>
        </div>
        <div className="buttons">
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
            <button type="button" onClick={() => controls.setSelection(DEMO_SCOPE)}>
              Select Checkout → Redis → Product DB
            </button>
            <button type="button" className="ghost" onClick={() => controls.setSelection(PLACE_ORDER)}>
              Place Order (sync path)
            </button>
            <button type="button" className="ghost" onClick={() => controls.clearSelection()}>
              Clear selection
            </button>
          </div>
          <ArchitectureCanvas
            components={graph.components}
            connections={graph.connections}
            selectedIds={selectedIds}
            inspectId={inspectId}
            metrics={run?.componentMetrics ?? null}
            animatePackets={Boolean(run) && !reduceMotion}
            onInspect={setInspectId}
            onToggleSelect={toggleSelect}
          />
        </div>

        <aside className="studio-rail">
          <SharedContext selection={selection} onCopyPrompt={copyPrompt} />
          <Inspector component={inspect} metric={inspectMetric} />
          <ProposalDrawer />
        </aside>
      </div>

      <div className="studio-bottom">
        <SimStrip />
        <ActivityLog activity={activity} />
      </div>

      <p className="footer-hint">
        Tool registry and manual invocation: <a href="/debug">/debug</a>. Every number on this page is a
        synthetic, directional assumption — not a production measurement.
      </p>
    </div>
  );
}
