import { formatCount } from './format';
import { lastRun, port } from '../contracts';

export function SimStrip() {
  const scenarios = port.listScenarios();
  const run = lastRun();

  return (
    <section className={`sim-strip ${run ? 'has-run' : 'is-empty'}`} aria-live="polite">
      <div className="sim-actions">
        <h2>Simulate</h2>
        <div className="buttons">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className={run?.scenarioId === s.id ? 'primary' : 'ghost'}
              onClick={() => port.simulate({ scenarioId: s.id })}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      {run ? (
        <div className="sim-result">
          <div>
            <div className={`run-head ${run.status}`}>
              <span className="run-status">{run.status}</span>
              <span>
                {formatCount(run.summary.completedRps)} of {formatCount(run.summary.inputRps)} rps complete
              </span>
              <span>{Math.round(run.summary.errorRate * 100)}% errors</span>
              <span>p95 {formatCount(run.summary.p95LatencyMs)} ms</span>
            </div>
            <ol className="causal">
              {run.causalEvents.map((e) => (
                <li key={e.step}>{e.text}</li>
              ))}
            </ol>
          </div>
          {run.bottlenecks.length > 0 && (
            <p className="hint bottleneck-card">
              <strong>First bottleneck</strong>
              <span className="stat-value">
                {run.bottlenecks[0].name} · {Math.round(run.bottlenecks[0].utilization * 100)}%
              </span>
              {run.bottlenecks[0].why}
            </p>
          )}
        </div>
      ) : (
        <p className="hint sim-empty">Run a scenario, or ask the agent. Results show up here either way.</p>
      )}
    </section>
  );
}
