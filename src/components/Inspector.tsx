import type { FixtureComponent } from '../contracts/fixture/graph';
import type { ComponentMetric } from '../contracts';

export function Inspector({
  component,
  metric,
}: {
  component: FixtureComponent | null;
  metric: ComponentMetric | undefined;
}) {
  if (!component) {
    return (
      <section className="rail-block">
        <h2>Inspector</h2>
        <p className="hint">Click a box to see its assumed capacity and notes. Shift-click adds it to the agent’s scope.</p>
      </section>
    );
  }

  const injection = Boolean(component.notes?.includes('SEEDED INJECTION TEST'));

  return (
    <section className="rail-block">
      <h2>Inspector</h2>
      <div className="row">
        <span className="row-label">Name</span>
        <span className="row-value">{component.name}</span>
      </div>
      <div className="row">
        <span className="row-label">Kind</span>
        <span className="row-value">{component.kind}</span>
      </div>
      <div className="row">
        <span className="row-label">Health</span>
        <span className={`row-value ${component.health === 'healthy' ? 'ok' : 'bad'}`}>{component.health}</span>
      </div>
      <div className="row">
        <span className="row-label">Capacity</span>
        <span className="row-value">
          {component.capacityRps === null ? 'not modelled' : `${component.capacityRps} rps`} — assumed
        </span>
      </div>
      <div className="row">
        <span className="row-label">Service time</span>
        <span className="row-value">{component.serviceTimeMs} ms assumed</span>
      </div>
      <div className="row">
        <span className="row-label">Overload</span>
        <span className="row-value">{component.overload}</span>
      </div>
      <p className="hint">{component.limits}</p>
      {metric && (
        <p className="hint">
          Last run: {Math.round(metric.demandRps)} rps demand, {Math.round(metric.utilization * 100)}% util, p95{' '}
          {metric.p95LatencyMs} ms
          {metric.lagSeconds != null ? `, lag ${metric.lagSeconds}s` : ''}.
        </p>
      )}
      {component.notes && (
        <div className={injection ? 'untrusted-notes' : 'hint'}>
          {injection ? <strong>Untrusted user-authored notes. </strong> : null}
          {component.notes}
        </div>
      )}
    </section>
  );
}
