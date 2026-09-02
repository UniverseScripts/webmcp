/**
 * The WebMCP adapter.
 *
 * This is the ONLY file in the repository permitted to reference
 * `document.modelContext`. Everything else imports from here, and a test
 * enforces that.
 *
 * Why an adapter at all, when the raw API is small:
 *
 *  1. WebMCP is an origin trial (Chrome 149-156) and the surface is still
 *     moving. One file absorbs that churn.
 *  2. There is no `unregisterTool()`. Unregistration happens only by aborting
 *     the AbortSignal handed in at registration, which is awkward to thread
 *     through React lifecycles. `registerTool` here returns a plain `() => void`.
 *  3. Chrome enforces validation rules that fail in two different ways -- some
 *     throw, one is a silent no-op. Both are handled here rather than in 5 tools.
 *  4. Tool output must stay under a character budget or agent guardrails trip,
 *     which presents as flaky agent behaviour and gets misdiagnosed as an API bug.
 */

// webmcp-types ships ambient globals (namespace WebMCP + Document.modelContext),
// not an ES module, so it is referenced rather than imported.
/// <reference types="webmcp-types" />

/* ------------------------------------------------------------------- budgets */

/** Chrome's recommended budgets (developer.chrome.com/docs/ai/webmcp/secure-tools). */
export const OUTPUT_LIMIT = 1500;
export const NAME_LIMIT = 30;
export const DESC_LIMIT = 500;
export const PARAM_DESC_LIMIT = 150;

/**
 * The house return shape.
 *
 * The spec types `execute` as returning `Promise<any>` and then "serializ[es] a
 * JavaScript value to a JSON string". Both a plain string and an MCP-style
 * `{content:[{type:'text',text}]}` envelope therefore work -- the envelope
 * simply arrives at the model wrapped in extra JSON punctuation that eats the
 * 1.5K budget. Chrome's own examples all return plain strings, so we do too.
 */
export const RETURN_SHAPE = 'plain-string' as const;

/* --------------------------------------------------------------------- types */

export interface ToolDef {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, ctx: { signal: AbortSignal }) => unknown;
}

export interface ToolActivity {
  id: string;
  name: string;
  at: number;
  input: unknown;
  status: 'ok' | 'error';
  outputPreview: string;
  durationMs: number;
}

/**
 * `executeTool` ships in Chrome and is documented, but is absent from
 * webmcp-types@0.1.5. Declared locally rather than patched into the global type.
 */
type ExecuteCapableContext = WebMCP.ModelContext & {
  executeTool?: (
    tool: WebMCP.RegisteredTool,
    input?: unknown,
    options?: unknown,
  ) => Promise<string | null>;
};

/* ---------------------------------------------------------------- capability */

export function isSupported(): boolean {
  return typeof document !== 'undefined' && !!document.modelContext;
}

/**
 * True when the document is origin-isolated. WebMCP is disabled outright in a
 * document that is not, so this is a functional prerequisite and not a hardening
 * step. Reading the response header alone is not sufficient: an absent header
 * does not prove the outcome, only this property does.
 */
export function isOriginIsolated(): boolean {
  return typeof window !== 'undefined' && window.originAgentCluster === true;
}

function context(): ExecuteCapableContext | null {
  if (typeof document === 'undefined') return null;
  return (document.modelContext as ExecuteCapableContext | undefined) ?? null;
}

/* ------------------------------------------------------------------ budgeting */

export function capOutput(s: string, limit = OUTPUT_LIMIT): string {
  if (s.length <= limit) return s;
  const suffix = '\n...[truncated; ask for a narrower scope]';
  return s.slice(0, Math.max(0, limit - suffix.length)) + suffix;
}

/**
 * Flow control smuggled into a description. Chrome's best practices say to gate
 * ordering through registration state instead, because a description that says
 * "call X first" is an instruction the agent may or may not honour, whereas an
 * unregistered tool simply is not there.
 *
 * The "use <other_tool> to ..." form is included because that is the shape this
 * repo actually shipped by accident, in a *parameter* description.
 */
const FLOW_CONTROL =
  /\bbefore you call\b|\bcall .{0,20}first\b|\bthen call\b|\bafter calling\b|\buse `?[a-z][a-z0-9]*_[a-z0-9_]+`? to\b|\bfirst (?:call|run|use)\b/i;
const NAME_RE = /^[A-Za-z0-9_.-]{1,128}$/;

/**
 * Validates a tool definition against Chrome's hard rules and its recommended
 * budgets. Returns human-readable violations; never throws.
 *
 * The hard rules mirror the error strings Chrome 150 actually emits, e.g.
 * "Tool description cannot be empty for tool: ", "Tool inputSchema 'type' must
 * be 'object' for tool: ", and "Failed to serialize inputSchema for tool: ...
 * circular references or non-serializable values."
 */
export function checkToolDef(def: ToolDef): string[] {
  const v: string[] = [];
  const n = def.name ?? '';

  if (!n) v.push('name is empty (Chrome rejects this)');
  else if (!NAME_RE.test(n)) v.push(`name "${n}" must be 1-128 chars of [A-Za-z0-9_.-]`);
  if (n.length > NAME_LIMIT) {
    v.push(`name "${n}" is ${n.length} chars, over the ${NAME_LIMIT}-char budget`);
  }

  if (!def.description) v.push(`${n}: description is empty (Chrome rejects this)`);
  else {
    if (def.description.length > DESC_LIMIT) {
      v.push(`${n}: description is ${def.description.length} chars, over ${DESC_LIMIT}`);
    }
    if (FLOW_CONTROL.test(def.description)) {
      v.push(`${n}: description encodes flow control; gate order by registration instead`);
    }
  }

  const schema = def.inputSchema as
    | { type?: unknown; properties?: unknown; required?: unknown }
    | undefined;

  if (schema !== undefined) {
    if (typeof schema !== 'object' || schema === null) {
      v.push(`${n}: inputSchema must be an object`);
    } else {
      if (typeof schema.type !== 'string') {
        v.push(`${n}: inputSchema.type must be a string`);
      } else if (schema.type !== 'object') {
        v.push(`${n}: inputSchema.type must be "object", got "${schema.type}"`);
      }

      const props = schema.properties;
      if (props !== undefined) {
        if (typeof props !== 'object' || props === null || Array.isArray(props)) {
          v.push(`${n}: inputSchema.properties must be an object`);
        } else {
          for (const [key, raw] of Object.entries(props as Record<string, unknown>)) {
            if (key.length > NAME_LIMIT) {
              v.push(`${n}.${key}: parameter name is ${key.length} chars, over ${NAME_LIMIT}`);
            }
            const d = (raw as { description?: unknown } | null)?.description;
            if (typeof d === 'string') {
              if (d.length > PARAM_DESC_LIMIT) {
                v.push(`${n}.${key}: description is ${d.length} chars, over ${PARAM_DESC_LIMIT}`);
              }
              // Parameter descriptions are descriptions too. Checking only the
              // tool description let "use tool X to see..." through, which is
              // exactly the flow control this rule exists to forbid.
              if (FLOW_CONTROL.test(d)) {
                v.push(`${n}.${key}: description encodes flow control; gate order by registration instead`);
              }
            }
          }
        }
      }

      if (schema.required !== undefined && !Array.isArray(schema.required)) {
        v.push(`${n}: inputSchema.required must be an array`);
      }

      try {
        JSON.stringify(schema);
      } catch {
        v.push(`${n}: inputSchema is not JSON-serialisable (circular ref, fn, or BigInt)`);
      }
    }
  }

  return v;
}

/* ------------------------------------------------------------- activity feed */

const activityListeners = new Set<(a: ToolActivity) => void>();

/** Every tool call is reported here, which is what the activity log renders. */
export function onActivity(cb: (a: ToolActivity) => void): () => void {
  activityListeners.add(cb);
  return () => {
    activityListeners.delete(cb);
  };
}

function emit(a: ToolActivity): void {
  for (const cb of activityListeners) {
    try {
      cb(a);
    } catch {
      /* a broken listener must never break a tool call */
    }
  }
}

let seq = 0;

function wrapExecute(def: ToolDef): WebMCP.ToolExecuteCallback {
  return async (input, ctx) => {
    const started = Date.now();
    const id = `act_${++seq}`;
    try {
      const raw = await def.execute((input ?? {}) as Record<string, unknown>, ctx);
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? null);
      const out = capOutput(text);
      emit({
        id,
        name: def.name,
        at: started,
        input,
        status: 'ok',
        outputPreview: out.slice(0, 200),
        durationMs: Date.now() - started,
      });
      return out;
    } catch (err) {
      // A thrown error must never reach the agent unbounded, and must never take
      // the page down. It becomes a short, structured, readable message.
      const msg = err instanceof Error ? err.message : String(err);
      const out = capOutput(`ERROR in ${def.name}: ${msg}`, 300);
      emit({
        id,
        name: def.name,
        at: started,
        input,
        status: 'error',
        outputPreview: out,
        durationMs: Date.now() - started,
      });
      return out;
    }
  };
}

/* -------------------------------------------------------------- registration */

/** Live registrations by tool name, so a re-register can retire its predecessor. */
const live = new Map<string, AbortController>();
/** Per-name promise chain, so registration order survives async races. */
const chains = new Map<string, Promise<void>>();

/**
 * Registers a tool and returns an unregister function.
 *
 * Guards three failure modes that are otherwise very hard to diagnose:
 *
 *  - "Duplicate tool name: X" THROWS. A fast selection change re-registers a
 *    scoped tool while the previous abort is still settling, so we retire the
 *    predecessor and serialise on a per-name promise chain.
 *  - "Tool 'X' was not registered because its AbortSignal was already aborted"
 *    is a silent NO-OP, not a throw. React StrictMode's double-invoked effects
 *    hit this directly, so `aborted` is re-checked at the point of registration.
 *  - Budget and schema violations throw in dev and degrade to a warning in
 *    production, because a missing tool is worse than an over-long description.
 */
export function registerTool(def: ToolDef): () => void {
  const violations = checkToolDef(def);
  if (violations.length) {
    const msg = `WebMCP tool "${def.name}" violates:\n  - ${violations.join('\n  - ')}`;
    if (import.meta.env?.DEV) throw new Error(msg);
    console.warn(msg);
  }

  const mc = context();
  if (!mc) return () => {};

  const controller = new AbortController();
  live.get(def.name)?.abort();
  live.set(def.name, controller);

  const chain = (chains.get(def.name) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      if (controller.signal.aborted) return; // unregistered before we got here
      await mc.registerTool(
        {
          name: def.name,
          title: def.title,
          description: def.description,
          inputSchema: def.inputSchema,
          annotations: def.annotations,
          execute: wrapExecute(def),
        },
        { signal: controller.signal },
      );
    })
    .catch((err: unknown) => {
      console.error(`WebMCP: failed to register "${def.name}"`, err);
    });

  chains.set(def.name, chain);

  return () => {
    controller.abort();
    if (live.get(def.name) === controller) live.delete(def.name);
  };
}

/** Registers many tools at once; the returned function unregisters all of them. */
export function registerTools(defs: ToolDef[]): () => void {
  const offs = defs.map(registerTool);
  return () => {
    for (const off of offs) off();
  };
}

/* ------------------------------------------------------------ introspection */

export function onToolChange(cb: () => void): () => void {
  const mc = context();
  if (!mc) return () => {};
  mc.addEventListener('toolchange', cb);
  return () => mc.removeEventListener('toolchange', cb);
}

export function listTools(): Promise<WebMCP.RegisteredTool[]> {
  const mc = context();
  return mc ? mc.getTools() : Promise.resolve([]);
}

/**
 * Manually invokes a registered tool, for the /debug route.
 *
 * The argument type is a genuine documentation/spec conflict: Chrome's docs say
 * to pass "input arguments as a valid JSON string", while the spec IDL types the
 * parameter as `object inputObject`. Live testing against Chrome 150 settles it
 * in Chrome's favour -- the object form throws -- so the string is tried first,
 * and the object form is kept as the fallback for whichever engine ships the
 * IDL as written.
 */
export async function invokeTool(
  tool: WebMCP.RegisteredTool,
  input: Record<string, unknown>,
): Promise<{ result: string | null; via: 'object' | 'json-string' }> {
  const mc = context();
  if (!mc?.executeTool) throw new Error('executeTool is unavailable in this browser');
  try {
    return { result: await mc.executeTool(tool, JSON.stringify(input)), via: 'json-string' };
  } catch {
    return { result: await mc.executeTool(tool, input), via: 'object' };
  }
}
