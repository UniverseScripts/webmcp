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
          <div className="sim-details">
            <div className={`sim-kpis ${run.status}`}>
              <div className="kpi-card status-kpi">
                <span className="kpi-label">Outcome</span>
                <span className="kpi-val status-val">{run.status.toUpperCase()}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Throughput</span>
                <span className="kpi-val">
                  {formatCount(run.summary.completedRps)}{' '}
                  <span className="kpi-sub">/ {formatCount(run.summary.inputRps)} rps</span>
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Error Rate</span>
                <span className={`kpi-val ${run.summary.errorRate > 0 ? 'bad' : 'ok'}`}>
                  {Math.round(run.summary.errorRate * 100)}%
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">P95 Latency</span>
                <span className="kpi-val">
                  {formatCount(run.summary.p95LatencyMs)} <span className="kpi-sub">ms</span>
                </span>
              </div>
            </div>

            <ol className="causal">
              {run.causalEvents.map((e) => (
                <li key={e.step}>{e.text}</li>
              ))}
            </ol>
          </div>
          {run.bottlenecks.length > 0 && (
            <div className="bottleneck-card">
              <span className="bottleneck-title">First bottleneck</span>
              <span className="stat-value">
                {run.bottlenecks[0].name} · {Math.round(run.bottlenecks[0].utilization * 100)}%
              </span>
              <p className="bottleneck-desc">{run.bottlenecks[0].why}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="hint sim-empty">Run a scenario, or ask the agent. Results show up here either way.</p>
      )}
    </section>
  );
}

