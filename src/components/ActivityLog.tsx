import type { ToolActivity } from '../webmcp/adapter';

export function ActivityLog({ activity }: { activity: ToolActivity[] }) {
  if (activity.length === 0) return null;

  return (
    <section className="activity-strip">
      <h2>Agent activity</h2>
      {activity.map((a) => (
        <div key={a.id} className={`activity ${a.status}`}>
          <span className="activity-name">{a.name}</span>
          <span className="dim">{new Date(a.at).toLocaleTimeString()}</span>
          <span className="dim">{a.durationMs} ms</span>
          <span className="preview">{a.outputPreview}</span>
        </div>
      ))}
    </section>
  );
}
