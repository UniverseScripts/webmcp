/**
 * Application shell.
 *
 * Owns the WebMCP registration lifecycle and the activity feed. Product UI lives
 * in `src/components/`. The adapter is still the only file that may touch
 * `document.modelContext`.
 */

import { useEffect, useState } from 'react';
import { Studio } from './components/Studio';
import { port } from './contracts';
import { useToolActivity, useWebMCPLifecycle } from './webmcp/lifecycle';
import './ui.css';

export default function App() {
  useWebMCPLifecycle();

  const [, setTick] = useState(0);
  const activity = useToolActivity(12);

  useEffect(() => port.subscribe(() => setTick((t) => t + 1)), []);

  return <Studio activity={activity} />;
}
