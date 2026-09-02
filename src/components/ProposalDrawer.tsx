import { controls, lastRun, port, type ProposalView, type SimulationResult } from '../contracts';

export function ProposalDrawer() {
  const proposals = [...controls.listProposals()];
  const drafts = proposals.filter((p) => p.status === 'draft');
  const run = lastRun();
  const firstDraft = drafts[0];
  const preview =
    firstDraft && run
      ? port.simulate({ scenarioId: run.scenarioId, withProposal: firstDraft.id })
      : null;

  return (
    <section className="rail-block proposals">
      <h2>
        Proposals <span className="count">{drafts.length}</span>
      </h2>
      <p className="hint">The agent can draft a change. Only you can apply it — that is what increments the revision.</p>
      {proposals.length === 0 && <p className="hint">Nothing proposed yet.</p>}
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          preview={firstDraft && p.id === firstDraft.id ? preview : null}
          baseline={run}
        />
      ))}
    </section>
  );
}

function ProposalCard({
  proposal: p,
  preview,
  baseline,
}: {
  proposal: ProposalView;
  preview: SimulationResult | null;
  baseline: SimulationResult | null;
}) {
  return (
    <div className="proposal">
      <div>
        <span className="proposal-meta">
          {p.id} · base revision {p.baseRevision} · <span className={`status ${p.status}`}>{p.status}</span>
        </span>
        <div className="proposal-title">{p.title}</div>
        <div className="hint">{p.rationale}</div>
        <ul className="changes">
          {p.changes.map((c, i) => (
            <li key={i}>
              <code>{c.op}</code>
              {c.targetId ? ` ${c.targetId}` : ''} — {summarizePayload(c.payload)}
            </li>
          ))}
        </ul>
        {p.expectedTradeoffs.length > 0 && (
          <div className="hint">Trade-offs: {p.expectedTradeoffs.join('; ')}</div>
        )}
        {p.status === 'draft' && preview && baseline && (
          <p className="hint">
            If applied on this scenario: errors {Math.round(baseline.summary.errorRate * 100)}% →{' '}
            {Math.round(preview.summary.errorRate * 100)}%, p95 {baseline.summary.p95LatencyMs}ms →{' '}
            {preview.summary.p95LatencyMs}ms. Directional only.
          </p>
        )}
      </div>
      {p.status === 'draft' && (
        <div className="buttons">
          <button type="button" className="primary" onClick={() => controls.applyProposal(p.id)}>
            Apply
          </button>
          <button type="button" className="ghost" onClick={() => controls.rejectProposal(p.id)}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function summarizePayload(payload: Record<string, unknown>): string {
  const parts = Object.entries(payload)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  return parts.join(', ') || '{}';
}
