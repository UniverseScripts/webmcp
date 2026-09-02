import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DebugPage from './DebugPage';

// StrictMode stays on deliberately: its double-invoked effects are exactly what
// trips WebMCP's silent "AbortSignal was already aborted" no-op, so running with
// it on keeps the adapter's guard honest.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugPage />
  </StrictMode>,
);
