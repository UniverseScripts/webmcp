import { lastRun, port } from '../contracts';

export function SimStrip() {
  const scenarios = port.listScenarios();
  const run = lastRun();

  return (
    <section className="sim-strip" aria-live="polite">
      <div className="sim-actions">
        <h2>Simulate</h2>
        <div className="buttons">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className={run?.scenarioId === s.id ? '' : 'ghost'}
              onClick={() => port.simulate({ scenarioId: s.id })}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      {run ? (
        <div className="sim-result">
          <div className={`run-head ${run.status}`}>
            {run.status.toUpperCase()} · {run.summary.completedRps} of {run.summary.inputRps} rps complete ·{' '}
            {Math.round(run.summary.errorRate * 100)}% errors · p95 {run.summary.p95LatencyMs}ms
          </div>
          <ol className="causal">
            {run.causalEvents.map((e) => (
              <li key={e.step}>{e.text}</li>
            ))}
          </ol>
          {run.bottlenecks.length > 0 && (
            <p className="hint">
              <strong>First bottleneck:</strong> {run.bottlenecks[0].name} at{' '}
              {Math.round(run.bottlenecks[0].utilization * 100)}% — {run.bottlenecks[0].why}
            </p>
          )}
        </div>
      ) : (
        <p className="hint">Run a scenario yourself, or ask the agent. The same numbers appear here either way.</p>
      )}
    </section>
  );
}
