/**
 * Application shell.
 *
 * LANE BOUNDARY: the architecture canvas, inspector, and proposal drawer belong
 * to the UI lane and land in `src/components/`. What lives here is only what the
 * WebMCP lane owns and the team plan assigns to it -- the registration lifecycle,
 * the feature-detection fallback, the shared-context readout, and the activity
 * log -- plus a placeholder so the deployed URL is never a blank page.
 */

import { useEffect, useState } from 'react';
import { controls, IS_FIXTURE, port } from './contracts';
import { isSupported } from './webmcp/adapter';
import { useToolActivity, useWebMCPLifecycle } from './webmcp/lifecycle';
import './ui.css';

const DEMO_SCOPE = ['checkout', 'redis', 'product_db'];

export default function App() {
  useWebMCPLifecycle();

  const [, setTick] = useState(0);
  const activity = useToolActivity(12);

  useEffect(() => port.subscribe(() => setTick((t) => t + 1)), []);

  const supported = isSupported();
  const selection = port.getSelection();
  const summary = port.getSummary('brief');

  return (
    <div className="page">
      <header>
        <h1>Executable ArchitectureLab</h1>
        <p>
          {summary.name} &middot; profile {summary.profile} &middot; revision{' '}
          <strong>{summary.revision}</strong>
          {IS_FIXTURE && <span className="fixture-tag">fixture data</span>}
        </p>
      </header>

      {!supported && (
        <div className="banner">
          <strong>Agent collaboration is unavailable in this browser.</strong> Everything on this
          page still works manually &mdash; you can select a flow and run every scenario yourself.
          To let an agent join, open this URL in the ChatGPT desktop app&rsquo;s browser, or in
          Chrome 149+ with <code>chrome://flags/#enable-webmcp-testing</code> enabled.
        </div>
      )}

      <section>
        <h2>Canvas</h2>
        <p className="hint">
          The architecture canvas lands here. Until it does, these controls stand in for
          selecting a flow so the scoped tools have something to scope to.
        </p>
        <div className="buttons">
          <button onClick={() => controls.setSelection(DEMO_SCOPE)}>
            Select Checkout &rarr; Redis &rarr; Product DB
          </button>
          <button className="ghost" onClick={() => controls.clearSelection()}>
            Clear selection
          </button>
        </div>
      </section>

      <section>
        <h2>What the agent can see</h2>
        {selection ? (
          <>
            <div className="row">
              <span className="row-label">Scope</span>
              <span className="row-value">{selection.components.map((c) => c.name).join(', ')}</span>
            </div>
            <div className="row">
              <span className="row-label">Boundary</span>
              <span className="row-value">
                {selection.boundary.map((b) => `${b.name} (${b.direction})`).join(', ') || 'none'}
              </span>
            </div>
            <div className="row">
              <span className="row-label">Revision</span>
              <span className="row-value">{selection.revision}</span>
            </div>
            <div className="row">
              <span className="row-label">Scoped tools</span>
              <span className={selection.hasValidFlow ? 'row-value ok' : 'row-value'}>
                {selection.hasValidFlow ? 'registered' : 'not registered (no complete flow)'}
              </span>
            </div>
          </>
        ) : (
          <p className="hint">
            Nothing is selected, so the agent can only see the two global read-only tools. Scoped
            tools appear the moment a flow is selected and disappear when it is cleared.
          </p>
        )}
      </section>

      <section>
        <h2>Agent activity</h2>
        {activity.length === 0 ? (
          <p className="hint">No tool calls yet. Ask your agent what it can do on this page.</p>
        ) : (
          activity.map((a) => (
            <div key={a.id} className={`activity ${a.status}`}>
              <code>{a.name}</code>
              <span className="dim">{new Date(a.at).toLocaleTimeString()}</span>
              <span className="dim">{a.durationMs}ms</span>
              <span className="preview">{a.outputPreview}</span>
            </div>
          ))
        )}
      </section>

      <p className="hint">
        Tool registry and manual invocation: <a href="/debug">/debug</a>. Every number on this page
        is a synthetic, directional assumption &mdash; not a production measurement.
      </p>
    </div>
  );
}
