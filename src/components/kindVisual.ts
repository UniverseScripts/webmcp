export const KIND_COLOR: Record<string, string> = {
  client: '#3b82f6',
  cdn: '#6366f1',
  gateway: '#8b5cf6',
  service: '#0ea5e9',
  cache: '#ef4444',
  relational_db: '#0d9488',
  queue: '#d97706',
  worker: '#64748b',
  external: '#0284c7',
};

export function kindColor(kind: string): string {
  return KIND_COLOR[kind] ?? '#64748b';
}
