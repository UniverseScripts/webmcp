import type { SelectionContext } from '../contracts';

const AGENT_PROMPT =
  'Inspect the selected architecture context. Run the cache-outage scenario, identify the first bottleneck, and propose the smallest mitigation. Do not assume numbers the page did not return.';

export function SharedContext({
  selection,
  onCopyPrompt,
}: {
  selection: SelectionContext | null;
  onCopyPrompt: () => void;
}) {
  return (
    <section className="rail-block">
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
            <span className="row-label">Scoped tools</span>
            <span className={selection.hasValidFlow ? 'row-value ok' : 'row-value'}>
              {selection.hasValidFlow ? 'registered' : 'not registered (need a connected flow)'}
            </span>
          </div>
        </>
      ) : (
        <p className="hint">
          Nothing selected. The agent only has the three global read-only tools until you pick a flow.
        </p>
      )}
      <button type="button" className="ghost" onClick={onCopyPrompt} disabled={!selection?.hasValidFlow}>
        Copy agent prompt
      </button>
      <p className="hint demo-prompt">{AGENT_PROMPT}</p>
    </section>
  );
}

export { AGENT_PROMPT };
