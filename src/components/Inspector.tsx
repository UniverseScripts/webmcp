import type { ComponentMetric } from '../contracts';
import type { FixtureComponent } from '../contracts/fixture/graph';
import { formatMs, formatRps, titleCase } from './format';
import { kindColor } from './kindVisual';
import { NodeGlyph } from './NodeGlyph';

export function Inspector({
  component,
  metric,
  inScope,
  onToggleScope,
}: {
  component: FixtureComponent | null;
  metric: ComponentMetric | undefined;
  inScope: boolean;
  onToggleScope: (id: string) => void;
}) {
  if (!component) {
    return (
      <section className="rail-block">
        <h2>Inspector</h2>
        <p className="hint">
          Click a node to inspect it. Switch the toolbar to <strong>Add to scope</strong> if you want clicks to
          change what the agent can see.
        </p>
      </section>
    );
  }

  const injection = Boolean(component.notes?.includes('SEEDED INJECTION TEST'));

  return (
    <section className="rail-block">
      <h2>Inspector</h2>
      <div className="inspect-head">
        <span className="kind-chip" style={{ background: kindColor(component.kind) }}>
          <NodeGlyph kind={component.kind} size={14} />
        </span>
        <div>
          <div className="inspect-name">{component.name}</div>
          <div className="inspect-kind">{titleCase(component.kind)}</div>
        </div>
      </div>
      <div className="stat-grid">
        <div>
          <div className="stat-label">Capacity</div>
          <div className="stat-value">{formatRps(component.capacityRps)}</div>
          <div className="stat-note">Assumed, not measured</div>
        </div>
        <div>
          <div className="stat-label">Service time</div>
          <div className="stat-value">{formatMs(component.serviceTimeMs)}</div>
          <div className="stat-note">Assumed</div>
        </div>
      </div>
      <div className="row">
        <span className="row-label">Health</span>
        <span className={`row-value ${component.health === 'healthy' ? 'ok' : 'bad'}`}>
          {titleCase(component.health)}
        </span>
      </div>
      <div className="row">
        <span className="row-label">Overload</span>
        <span className="row-value">{titleCase(component.overload)}</span>
      </div>
      <p className="hint">{component.limits}</p>
      {metric && (
        <p className="hint">
          Last run: {formatRps(Math.round(metric.demandRps))} demand, {Math.round(metric.utilization * 100)}% used,
          p95 {formatMs(metric.p95LatencyMs)}
          {metric.lagSeconds != null ? `, lag ${metric.lagSeconds}s` : ''}.
        </p>
      )}
      <button type="button" className={inScope ? 'ghost' : ''} onClick={() => onToggleScope(component.id)}>
        {inScope ? 'Remove from agent scope' : 'Add to agent scope'}
      </button>
      {component.notes && (
        <div className={injection ? 'untrusted-notes' : 'hint'}>
          {injection ? <strong>Untrusted user-authored notes. </strong> : null}
          {component.notes}
        </div>
      )}
    </section>
  );
}
