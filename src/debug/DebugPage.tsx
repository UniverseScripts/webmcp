/**
 * /debug -- the WebMCP verification surface.
 *
 * Three audiences:
 *   1. Me, proving the contract on a deployed origin rather than on localhost.
 *   2. The UI and simulation lanes, who can see tool behaviour without asking me.
 *   3. Anyone reviewing the entry who wants to confirm the tools are real.
 *
 * It mounts the same lifecycle as the product page, so the registry below is the
 * real thing and not a mirror: `getTools()` reports tools registered by the
 * calling document, so a passive observer page would show an empty list.
 */

import { useCallback, useEffect, useState } from 'react';
import { controls, IS_FIXTURE, port } from '../contracts';
import {
  DESC_LIMIT,
  invokeTool,
  isOriginIsolated,
  isSupported,
  listTools,
  NAME_LIMIT,
  onToolChange,
  OUTPUT_LIMIT,
  RETURN_SHAPE,
} from '../webmcp/adapter';
import { useToolActivity, useWebMCPLifecycle } from '../webmcp/lifecycle';
import './debug.css';

type RegisteredTool = Awaited<ReturnType<typeof listTools>>[number];

const SELECTION_PRESETS: { label: string; ids: string[] }[] = [
  { label: 'Checkout -> Redis -> Product DB', ids: ['checkout', 'redis', 'product_db'] },
  { label: 'Full synchronous path', ids: ['browser', 'cdn', 'gateway', 'checkout', 'redis', 'product_db', 'order_db'] },
  { label: 'Single component (no valid flow)', ids: ['checkout'] },
];

function chromeVersion(): string {
  const m = /Chrome\/(\d+\.\d+\.\d+\.\d+)/.exec(navigator.userAgent);
  return m ? m[1] : 'not Chrome';
}

function toolsPolicy(): string {
  const fp = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy;
  if (!fp) return 'unknown (featurePolicy unavailable)';
  try {
    return fp.allowsFeature('tools') ? 'allowed' : 'BLOCKED';
  } catch {
    return 'unknown';
  }
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className={ok === undefined ? 'row-value' : ok ? 'row-value ok' : 'row-value bad'}>{value}</span>
    </div>
  );
}

function defaultInput(tool: RegisteredTool): string {
  const schema = tool.inputSchema as { required?: string[]; properties?: Record<string, { enum?: unknown[] }> } | undefined;
  const required = schema?.required ?? [];
  if (required.length === 0) return '{}';
  const seed: Record<string, unknown> = {};
  for (const key of required) {
    const prop = schema?.properties?.[key];
    if (prop?.enum?.length) seed[key] = prop.enum[0];
    else if (key === 'baseRevision') seed[key] = port.getRevision();
    else if (key === 'changes') seed[key] = [{ op: 'update_component', targetId: 'product_db', payload: { capacityRps: 800 } }];
    else seed[key] = '';
  }
  return JSON.stringify(seed, null, 2);
}

function ToolCard({ tool }: { tool: RegisteredTool }) {
  const [input, setInput] = useState(() => defaultInput(tool));
  const [result, setResult] = useState<string | null>(null);
  const [via, setVia] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setResult(null);
    try {
      const parsed = JSON.parse(input || '{}') as Record<string, unknown>;
      const out = await invokeTool(tool, parsed);
      setVia(out.via);
      setResult(out.result ?? '(null -- the tool triggered a navigation)');
    } catch (err) {
      setVia('');
      setResult(`INVOKE FAILED: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [input, tool]);

  const nameOver = tool.name.length > NAME_LIMIT;
  const descOver = tool.description.length > DESC_LIMIT;

  return (
    <div className="tool">
      <div className="tool-head">
        <code className={nameOver ? 'over' : ''}>{tool.name}</code>
        <span className="badges">
          {tool.annotations?.readOnlyHint && <span className="badge ro">readOnly</span>}
          {tool.annotations?.untrustedContentHint && <span className="badge untrusted">untrusted</span>}
          <span className={descOver ? 'badge over' : 'badge'}>
            {tool.name.length}/{NAME_LIMIT} name, {tool.description.length}/{DESC_LIMIT} desc
          </span>
        </span>
      </div>
      <p className="tool-desc">{tool.description}</p>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} rows={4} />
      <div className="tool-actions">
        <button onClick={run} disabled={busy}>
          {busy ? 'Running...' : 'Invoke'}
        </button>
        {via && <span className="via">accepted args as: {via}</span>}
      </div>
      {result !== null && (
        <pre className="result">
          {result}
          {'\n\n'}
          <span className="dim">
            {result.length} chars / {OUTPUT_LIMIT} budget
          </span>
        </pre>
      )}
    </div>
  );
}

export default function DebugPage() {
  useWebMCPLifecycle();

  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [, setTick] = useState(0);
  const activity = useToolActivity(30);

  const refresh = useCallback(() => {
    listTools().then(setTools).catch(() => setTools([]));
  }, []);

  useEffect(() => {
    refresh();
    return onToolChange(refresh);
  }, [refresh]);

  // Re-render when the revision, selection or proposal list changes. `tick` is
  // only a render trigger; the values below are read fresh on every render
  // rather than memoised, because memoising on a counter buys nothing and reads
  // as a mistake.
  useEffect(() => port.subscribe(() => setTick((t) => t + 1)), []);

  const supported = isSupported();
  const selection = port.getSelection();
  const proposals = [...controls.listProposals()];

  return (
    <div className="page">
      <header>
        <h1>WebMCP debug</h1>
        <p>
          Executable ArchitectureLab &middot; revision <strong>{port.getRevision()}</strong>
          {IS_FIXTURE && <span className="fixture-tag">fixture data</span>}
        </p>
      </header>

      {!supported && (
        <div className="banner">
          <strong>WebMCP is not available in this browser.</strong> Everything below is inert.
          Open in the ChatGPT desktop app&rsquo;s browser, or in Chrome 149+ with{' '}
          <code>chrome://flags/#enable-webmcp-testing</code> enabled and the browser relaunched.
        </div>
      )}

      <section>
        <h2>Environment</h2>
        <Row label="document.modelContext" value={supported ? 'present' : 'absent'} ok={supported} />
        <Row
          label="window.originAgentCluster"
          value={String(isOriginIsolated())}
          ok={isOriginIsolated()}
        />
        <Row label='Permissions Policy "tools"' value={toolsPolicy()} ok={toolsPolicy() === 'allowed'} />
        <Row label="Secure context" value={String(window.isSecureContext)} ok={window.isSecureContext} />
        <Row label="Chrome version" value={chromeVersion()} />
        <Row label="Origin" value={window.location.origin} />
        <Row label="Return shape in use" value={RETURN_SHAPE} />
      </section>

      <section>
        <h2>Selection</h2>
        <p className="hint">
          Scoped tools register and unregister as this changes. Watch the registry below update
          with no page reload &mdash; that is the behaviour the whole entry rests on.
        </p>
        <div className="buttons">
          {SELECTION_PRESETS.map((p) => (
            <button key={p.label} onClick={() => controls.setSelection(p.ids)}>
              {p.label}
            </button>
          ))}
          <button className="ghost" onClick={() => controls.clearSelection()}>
            Clear selection
          </button>
        </div>
        <Row
          label="Current scope"
          value={
            selection
              ? `${selection.components.map((c) => c.name).join(', ')} (validFlow: ${selection.hasValidFlow})`
              : 'nothing selected'
          }
        />
      </section>

      <section>
        <h2>
          Registered tools <span className="count">{tools.length}</span>
        </h2>
        {tools.length === 0 && <p className="hint">No tools registered.</p>}
        {tools.map((t) => (
          <ToolCard key={t.name} tool={t} />
        ))}
      </section>

      <section>
        <h2>Proposals</h2>
        <p className="hint">
          Applying a proposal is the only path that mutates the graph, and it increments the
          revision. Apply one, then re-run <code>propose_architecture_patch</code> with the old
          <code> baseRevision</code> to see the stale-revision rejection.
        </p>
        {proposals.length === 0 && <p className="hint">No proposals drafted yet.</p>}
        {proposals.map((p) => (
          <div key={p.id} className="proposal">
            <div>
              <code>{p.id}</code> &middot; base revision {p.baseRevision} &middot;{' '}
              <span className={`status ${p.status}`}>{p.status}</span>
              <div className="proposal-title">{p.title}</div>
              <div className="hint">{p.rationale}</div>
            </div>
            {p.status === 'draft' && (
              <div className="buttons">
                <button onClick={() => controls.applyProposal(p.id)}>Apply</button>
                <button className="ghost" onClick={() => controls.rejectProposal(p.id)}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2>Activity log</h2>
        {activity.length === 0 && <p className="hint">No tool calls yet.</p>}
        {activity.map((a) => (
          <div key={a.id} className={`activity ${a.status}`}>
            <code>{a.name}</code>
            <span className="dim">{new Date(a.at).toLocaleTimeString()}</span>
            <span className="dim">{a.durationMs}ms</span>
            <span className="preview">{a.outputPreview}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
