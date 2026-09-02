/**
 * Registration lifecycle.
 *
 * Two global read-only tools are registered once, at load. Three scoped tools
 * are registered when the user selects a valid flow and unregistered when the
 * selection changes or clears -- which is the behaviour the whole product claim
 * rests on: the agent's available capabilities follow the human's attention.
 *
 * The scoped effect is keyed on `selectionKey`, a PRIMITIVE string. Keying a
 * registration effect on an object reference re-runs it on every render and
 * thrashes registration, which then looks like an API bug.
 *
 * Tool bodies read through `port.*` at execute time rather than closing over a
 * snapshot at registration time, so there is no stale-state hazard here.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { port } from '../contracts';
import { onActivity, registerTools, type ToolActivity } from './adapter';
import { globalTools, scopedTools } from './tools';

const EMPTY_KEY = '';

function subscribe(cb: () => void): () => void {
  return port.subscribe(cb);
}

/** A primitive that changes exactly when the agent-visible scope changes. */
function selectionKeySnapshot(): string {
  const sel = port.getSelection();
  return sel && sel.hasValidFlow ? sel.selectionKey : EMPTY_KEY;
}

/**
 * Mount once, near the root. Returns nothing: registration is a side effect of
 * the page being open and of what the user has selected, not app state.
 */
export function useWebMCPLifecycle(): void {
  useEffect(() => registerTools(globalTools), []);

  const selectionKey = useSyncExternalStore(subscribe, selectionKeySnapshot, () => EMPTY_KEY);

  useEffect(() => {
    if (selectionKey === EMPTY_KEY) return;
    return registerTools(scopedTools());
  }, [selectionKey]);
}

/**
 * Live feed of every tool call, newest first. This is what makes agent work
 * legible on screen -- without it, a successful tool call is invisible on video.
 */
export function useToolActivity(limit = 25): ToolActivity[] {
  const [log, setLog] = useState<ToolActivity[]>([]);

  const push = useCallback(
    (a: ToolActivity) => setLog((prev) => [a, ...prev].slice(0, limit)),
    [limit],
  );

  useEffect(() => onActivity(push), [push]);

  return log;
}
