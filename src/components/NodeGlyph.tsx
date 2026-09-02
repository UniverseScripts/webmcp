export function NodeGlyph({ kind, size = 18 }: { kind: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <NodeGlyphPaths kind={kind} />
    </svg>
  );
}

/** Same glyph as SVG children for the canvas. */
export function NodeGlyphPaths({ kind }: { kind: string }) {
  const c = {
    fill: 'none',
    stroke: '#fff',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (kind) {
    case 'client':
      return <path {...c} d="M4 5h16v10H4zM8 19h8M12 15v4" />;
    case 'cdn':
      return (
        <>
          <circle {...c} cx="12" cy="12" r="8" />
          <path {...c} d="M4 12h16M12 4c2.5 3 3.5 6 3.5 8s-1 5-3.5 8c-2.5-3-3.5-6-3.5-8s1-5 3.5-8z" />
        </>
      );
    case 'gateway':
      return <path {...c} d="M5 20V8l7-4 7 4v12M9 20v-6h6v6" />;
    case 'service':
      return <path {...c} d="M12 4l8 4v8l-8 4-8-4V8zM12 12l8-4M12 12v8M12 12L4 8" />;
    case 'cache':
      return <path {...c} d="M13 3L6 14h6l-1 7 7-11h-6z" />;
    case 'relational_db':
      return (
        <>
          <ellipse {...c} cx="12" cy="7" rx="7" ry="3" />
          <path {...c} d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        </>
      );
    case 'queue':
      return <path {...c} d="M4 7h16M4 12h16M4 17h16" />;
    case 'worker':
      return (
        <>
          <circle {...c} cx="12" cy="12" r="3" />
          <path {...c} d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </>
      );
    case 'external':
      return <path {...c} d="M6 17a5 5 0 0 1 1-9 6 6 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7H7" />;
    default:
      return <rect {...c} x="5" y="5" width="14" height="14" rx="3" />;
  }
}
