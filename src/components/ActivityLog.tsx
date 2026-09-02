import type { ToolActivity } from '../webmcp/adapter';

export function ActivityLog({ activity }: { activity: ToolActivity[] }) {
  return (
    <section className="activity-strip">
      <h2>Agent activity</h2>
      {activity.length === 0 ? (
        <p className="hint">No tool calls yet.</p>
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
  );
}
