/**
 * Application shell.
 *
 * LANE BOUNDARY: the architecture canvas, inspector, and richly designed
 * proposal drawer belong to the UI lane and land in `src/components/`. What
 * lives here is what the WebMCP lane owns and the team plan assigns to it --
 * the registration lifecycle, the feature-detection fallback, the shared-context
 * readout, the activity log, and the human approval control.
 *
 * The manual scenario buttons are not decoration. The fallback promise is that
 * everything stays usable without WebMCP, and that promise is only true if a
 * human can run a scenario without an agent. They are also what makes an
 * agent-triggered run visible on screen rather than only in a chat window.
 */

import { useEffect, useState } from 'react';
import { controls, IS_FIXTURE, lastRun, port } from './contracts';
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
  const scenarios = port.listScenarios();
  const run = lastRun();
  const proposals = [...controls.listProposals()];
  const drafts = proposals.filter((p) => p.status === 'draft');

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
          <strong>Agent collaboration is unavailable in this browser.</strong> Everything below
          still works &mdash; select a flow and run any scenario yourself. To let an agent join,
          open this URL in the ChatGPT desktop app&rsquo;s browser, or in Chrome 149+ with{' '}
          <code>chrome://flags/#enable-webmcp-testing</code> enabled.
        </div>
      )}

      <section>
        <h2>Focus</h2>
        <p className="hint">
          The architecture canvas lands here. Until it does, these controls stand in for selecting
          a flow. Whatever is selected is exactly what the agent can see &mdash; nothing more.
        </p>
        <div className="buttons">
          <button onClick={() => controls.setSelection(DEMO_SCOPE)}>
            Select Checkout &rarr; Redis &rarr; Product DB
          </button>
          <button className="ghost" onClick={() => controls.clearSelection()}>
            Clear selection
          </button>
          <button className="ghost" onClick={() => controls.resetToSeed()}>
            Reset to seed
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
            Nothing is selected, so the agent can only see the three global read-only tools. Scoped
            tools appear the moment a flow is selected and disappear when it is cleared.
          </p>
        )}
      </section>

      <section>
        <h2>Simulate</h2>
        <p className="hint">
          Run these yourself, or ask an agent to. Either way the result appears here, so an agent&rsquo;s
          work is visible on the page rather than only in its chat window.
        </p>
        <div className="buttons">
          {scenarios.map((s) => (
            <button
              key={s.id}
              className={run?.scenarioId === s.id ? '' : 'ghost'}
              onClick={() => port.simulate({ scenarioId: s.id })}
            >
              {s.name}
            </button>
          ))}
        </div>

        {run ? (
          <>
            <div className="row">
              <span className="row-label">Status</span>
              <span className={`row-value ${run.status === 'healthy' ? 'ok' : run.status === 'failing' ? 'bad' : ''}`}>
                {run.status.toUpperCase()} &middot; {run.summary.completedRps} of {run.summary.inputRps} rps
                complete &middot; {Math.round(run.summary.errorRate * 100)}% errors &middot; p95{' '}
                {run.summary.p95LatencyMs}ms
              </span>
            </div>
            <ol className="causal">
              {run.causalEvents.map((e) => (
                <li key={e.step}>{e.text}</li>
              ))}
            </ol>
            {run.bottlenecks.length > 0 && (
              <p className="hint">
                <strong>First bottleneck:</strong> {run.bottlenecks[0].name} at{' '}
                {Math.round(run.bottlenecks[0].utilization * 100)}% &mdash; {run.bottlenecks[0].why}
              </p>
            )}
            <p className="hint">
              <strong>Assumptions:</strong> {run.assumptions.join(' ')}
            </p>
          </>
        ) : (
          <p className="hint">No run yet.</p>
        )}
      </section>

      <section>
        <h2>
          Proposals <span className="count">{drafts.length}</span>
        </h2>
        <p className="hint">
          An agent can draft a change but never apply one. Applying is a button only you can press,
          and it is the only thing in the system that increments the revision.
        </p>
        {proposals.length === 0 && (
          <p className="hint">Nothing proposed yet. Ask your agent for the smallest safe mitigation.</p>
        )}
        {proposals.map((p) => (
          <div key={p.id} className="proposal">
            <div>
              <code>{p.id}</code> &middot; base revision {p.baseRevision} &middot;{' '}
              <span className={`status ${p.status}`}>{p.status}</span>
              <div className="proposal-title">{p.title}</div>
              <div className="hint">{p.rationale}</div>
              <ul className="changes">
                {p.changes.map((c, i) => (
                  <li key={i}>
                    <code>{c.op}</code>
                    {c.targetId ? ` ${c.targetId}` : ''} &mdash; {JSON.stringify(c.payload)}
                  </li>
                ))}
              </ul>
              {p.expectedTradeoffs.length > 0 && (
                <div className="hint">Trade-offs: {p.expectedTradeoffs.join('; ')}</div>
              )}
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
