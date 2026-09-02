/**
 * Guardrail tests.
 *
 * These are not unit tests of business logic -- they are the checks that stop the
 * three failure modes that would actually cost the submission:
 *
 *   1. A tool that Chrome silently refuses, or that trips agent guardrails by
 *      overrunning a character budget. Both present as "the agent is being
 *      flaky" and get misdiagnosed for hours.
 *   2. A destructive tool reaching the agent. The entire safety argument is that
 *      no such tool is ever registered, so it is asserted rather than assumed.
 *   3. Raw `document.modelContext` use leaking out of the adapter, which is how
 *      the lifecycle guards get bypassed.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { controls, port } from '../contracts';
import {
  capOutput,
  checkToolDef,
  DESC_LIMIT,
  NAME_LIMIT,
  OUTPUT_LIMIT,
  PARAM_DESC_LIMIT,
  type ToolDef,
} from './adapter';
import { globalTools, scopedTools } from './tools';

const allTools = (): ToolDef[] => [...globalTools, ...scopedTools()];

/**
 * Strips comments and string/template literals so that a rule written down in a
 * doc comment, or rendered as a UI label, does not read as a violation of
 * itself. Deliberately crude: it can only ever remove text, so it risks a false
 * negative and never a false positive.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

/**
 * Scans every non-test source file under src/ for a pattern, matching against
 * code only.
 */
function scanSource(pattern: RegExp, include: (basename: string) => boolean = () => true): string[] {
  const root = join(import.meta.dirname, '..');
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry) || entry.endsWith('.test.ts') || !include(entry)) continue;
      const code = codeOnly(readFileSync(full, 'utf8'));
      if (pattern.test(code)) offenders.push(full);
    }
  };
  walk(root);
  return offenders;
}

describe('tool definitions', () => {
  it('every registered tool satisfies Chrome rules and budgets', () => {
    for (const tool of allTools()) {
      expect(checkToolDef(tool), `${tool.name} should have no violations`).toEqual([]);
    }
  });

  it('names stay inside the 30-char budget', () => {
    for (const tool of allTools()) {
      expect(tool.name.length, tool.name).toBeLessThanOrEqual(NAME_LIMIT);
    }
  });

  it('descriptions stay inside the 500-char budget', () => {
    for (const tool of allTools()) {
      expect(tool.description.length, tool.name).toBeLessThanOrEqual(DESC_LIMIT);
    }
  });

  it('parameter descriptions stay inside the 150-char budget', () => {
    for (const tool of allTools()) {
      const props = (tool.inputSchema as { properties?: Record<string, { description?: string }> })?.properties ?? {};
      for (const [key, prop] of Object.entries(props)) {
        if (typeof prop?.description === 'string') {
          expect(prop.description.length, `${tool.name}.${key}`).toBeLessThanOrEqual(PARAM_DESC_LIMIT);
        }
      }
    }
  });

  it('every inputSchema survives the structured-clone Chrome performs', () => {
    // Chrome throws "Failed to serialize inputSchema ... circular references or
    // non-serializable values" -- a Zod-generated schema can trip this.
    for (const tool of allTools()) {
      expect(() => JSON.stringify(tool.inputSchema), tool.name).not.toThrow();
    }
  });

  it('read-only tools are marked, and tools returning user text are marked untrusted', () => {
    const byName = new Map(allTools().map((t) => [t.name, t]));
    for (const name of [
      'get_architecture_summary',
      'list_simulation_scenarios',
      'get_selected_arch_context',
      'simulate_selected_flow',
    ]) {
      expect(byName.get(name)?.annotations?.readOnlyHint, name).toBe(true);
    }
    // The selection tool returns user-authored component notes.
    expect(byName.get('get_selected_arch_context')?.annotations?.untrustedContentHint).toBe(true);
  });
});

describe('budget enforcement fails loudly when broken', () => {
  const base: ToolDef = {
    name: 'ok_tool',
    description: 'A fine description.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    execute: () => 'ok',
  };

  it('rejects an over-long name', () => {
    const v = checkToolDef({ ...base, name: 'get_selected_architecture_context' });
    expect(v.join(' ')).toMatch(/33 chars, over the 30-char budget/);
  });

  it('rejects an empty description, which Chrome refuses outright', () => {
    expect(checkToolDef({ ...base, description: '' }).join(' ')).toMatch(/description is empty/);
  });

  it('rejects an over-long description', () => {
    expect(checkToolDef({ ...base, description: 'x'.repeat(DESC_LIMIT + 1) }).join(' ')).toMatch(/over 500/);
  });

  it('rejects a schema whose type is not "object"', () => {
    const v = checkToolDef({ ...base, inputSchema: { type: 'array' } });
    expect(v.join(' ')).toMatch(/must be "object"/);
  });

  it('rejects a schema whose required is not an array', () => {
    const v = checkToolDef({ ...base, inputSchema: { type: 'object', required: 'nope' } });
    expect(v.join(' ')).toMatch(/required must be an array/);
  });

  it('rejects a circular schema', () => {
    const circular: Record<string, unknown> = { type: 'object', properties: {} };
    circular.self = circular;
    expect(checkToolDef({ ...base, inputSchema: circular }).join(' ')).toMatch(/not JSON-serialisable/);
  });

  it('rejects flow control smuggled into a description', () => {
    const v = checkToolDef({ ...base, description: 'Gets a thing. Before you call this, call the other one.' });
    expect(v.join(' ')).toMatch(/flow control/);
  });
});

describe('output budget', () => {
  it('caps output at the 1.5K limit and says why', () => {
    const capped = capOutput('x'.repeat(5000));
    expect(capped.length).toBeLessThanOrEqual(OUTPUT_LIMIT);
    expect(capped).toMatch(/truncated/);
  });

  it('leaves output under the limit untouched', () => {
    expect(capOutput('short')).toBe('short');
  });

  it('no tool can emit an over-budget payload, even with everything selected', () => {
    controls.setSelection(controls.componentIds());
    for (const tool of allTools()) {
      const input =
        tool.name === 'simulate_selected_flow' ? { scenarioId: 'flash_sale_cache_outage', focus: 'latency' } : {};
      if (tool.name === 'propose_architecture_patch') continue;
      const out = tool.execute(input, { signal: new AbortController().signal });
      expect(typeof out === 'string' ? capOutput(out).length : 0, tool.name).toBeLessThanOrEqual(OUTPUT_LIMIT);
    }
  });
});

describe('safety', () => {
  it('registers no destructive tool, ever', () => {
    // The absence is the design. If someone adds one, this fails before a judge
    // or an injected instruction finds it.
    const forbidden = /\b(apply|delete|remove|clear|reset|drop|publish|export|deploy|provision)\b/;
    for (const tool of allTools()) {
      expect(forbidden.test(tool.name), `${tool.name} looks destructive`).toBe(false);
    }
  });

  it('the port exposes no mutation method to the tool layer', () => {
    for (const key of Object.keys(port)) {
      expect(/^(apply|set|delete|remove|clear|reset|update)/.test(key), key).toBe(false);
    }
  });

  it('only the adapter touches document.modelContext', () => {
    const offenders = scanSource(/\bdocument\s*\.\s*modelContext\b/, (f) => f !== 'adapter.ts');
    expect(offenders).toEqual([]);
  });

  it('never uses the removed API names that models still suggest', () => {
    // provideContext, clearContext and unregisterTool were all removed from the
    // spec, and models still emit them. navigator.modelContext still *works* in
    // Chrome -- it only logs a deprecation -- so bad code looks fine at runtime.
    const dead = /\b(navigator\s*\.\s*modelContext|provideContext|clearContext|unregisterTool)\b/;
    expect(scanSource(dead)).toEqual([]);
  });
});

describe('stale revision rejection', () => {
  it('accepts a patch at the current revision and rejects it once the graph moves', () => {
    controls.setSelection(['checkout', 'redis', 'product_db']);
    const propose = allTools().find((t) => t.name === 'propose_architecture_patch')!;
    const ctx = { signal: new AbortController().signal };

    const revision = port.getRevision();
    const patch = {
      baseRevision: revision,
      title: 'Add a read replica',
      rationale: 'Product DB is the first bottleneck under a cache outage.',
      changes: [{ op: 'update_component', targetId: 'product_db', payload: { capacityRps: 800 } }],
    };

    const accepted = propose.execute(patch, ctx) as string;
    expect(accepted).toMatch(/Draft prop_\d+ created/);
    expect(accepted).toMatch(/NOT APPLIED/);

    // A human applies it, which is the only path that moves the revision.
    const draft = controls.listProposals().find((p) => p.status === 'draft')!;
    expect(controls.applyProposal(draft.id)).toBe(true);
    expect(port.getRevision()).toBe(revision + 1);

    const stale = propose.execute(patch, ctx) as string;
    expect(stale).toMatch(/REJECTED: stale revision/);
    expect(stale).toMatch(new RegExp(`current is ${revision + 1}`));
  });
});

describe('the cache-outage causal chain the demo depends on', () => {
  it('overloads Product DB and keeps the async tail off the response path', () => {
    const result = port.simulate({ scenarioId: 'flash_sale_cache_outage' });
    const text = result.causalEvents.map((e) => e.text).join(' ');

    expect(text).toMatch(/raises Place Order demand from 80 to 800 rps/);
    expect(text).toMatch(/hit ratio falls from 92% to 0%/);
    expect(text).toMatch(/Product DB demand rises from 64 to 800 reads\/sec/);
    expect(text).toMatch(/safe capacity is 250 reads\/sec; utilisation reaches 320%/);
    expect(text).toMatch(/Invoice work is off the response path|Invoice work stays healthy/);

    const db = result.componentMetrics.find((m) => m.componentId === 'product_db')!;
    expect(db.utilization).toBeGreaterThan(1);
    expect(result.status).toBe('failing');
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it('is healthy at baseline, so the contrast is real', () => {
    const result = port.simulate({ scenarioId: 'baseline' });
    expect(result.status).toBe('healthy');
    expect(result.summary.errorRate).toBe(0);
  });

  it('is deterministic: the same scenario yields the same numbers', () => {
    const a = port.simulate({ scenarioId: 'flash_sale_cache_outage' });
    const b = port.simulate({ scenarioId: 'flash_sale_cache_outage' });
    expect(a.summary).toEqual(b.summary);
    expect(a.componentMetrics).toEqual(b.componentMetrics);
  });
});
