export function formatRps(n: number | null | undefined): string {
  if (n == null) return 'Not modelled';
  return `${n.toLocaleString('en-US')} rps`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatMs(n: number): string {
  return `${formatCount(n)} ms`;
}

export function titleCase(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
