#!/usr/bin/env node
/**
 * Automated proof that WebMCP actually works at a URL.
 *
 * Drives the real installed Chrome (not a bundled Chromium) with the WebMCP
 * features forced on, then asserts the whole contract end-to-end:
 *
 *   - the document is origin-isolated, without which the API is disabled
 *   - document.modelContext exists
 *   - the global tools register at load
 *   - selecting a flow registers the scoped tools, and clearing the selection
 *     revokes them -- the dynamic behaviour the entry rests on
 *   - a tool executes and returns a bounded plain string
 *   - a proposal is drafted but NOT applied, and a stale revision is rejected
 *   - the seeded prompt-injection payload reaches the agent correctly fenced
 *   - /debug is reachable
 *
 * That last group is what a human otherwise re-checks by hand after every
 * deploy, which is exactly the check that gets skipped at 3am.
 *
 * Usage: node scripts/verify-live.mjs https://your-url [--headed]
 *
 * A URL is required on purpose. Defaulting to localhost is how "verified on
 * localhost and called it done" happens, and localhost passing is not evidence
 * that the deployed origin works -- deployment protection and header rewriting
 * only exist in production.
 */

import { chromium } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http'));
const headed = process.argv.includes('--headed');

if (!url) {
  console.error('usage: node scripts/verify-live.mjs <url> [--headed]');
  console.error('A URL is required. Verify the deployed origin, not localhost.');
  process.exit(2);
}

// Feature names read out of chrome.dll in the Chrome 150 install: WebMCPSupport
// gates the API, WebMCPTesting is what chrome://flags/#enable-webmcp-testing
// turns on. Forcing them here means the check does not depend on a human having
// flipped a flag in their own profile.
const FEATURES = 'WebMCPSupport,WebMCPTesting';

const GLOBAL_TOOLS = ['get_architecture_summary', 'get_component_catalog', 'list_simulation_scenarios'];
const SCOPED_TOOLS = ['get_selected_arch_context', 'propose_architecture_patch', 'simulate_selected_flow'];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  return ok;
};

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !headed,
  args: [`--enable-features=${FEATURES}`, '--enable-blink-features=WebMCP'],
});

const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

console.log(`\nVerifying ${url} in Chrome with ${FEATURES}\n`);

/** Runs a tool the way an agent would, through executeTool. */
const callTool = (name, args) =>
  page.evaluate(
    async ([toolName, toolArgs]) => {
      const tools = await document.modelContext.getTools();
      const tool = tools.find((t) => t.name === toolName);
      if (!tool) return { error: `tool ${toolName} not registered` };
      try {
        const r = await document.modelContext.executeTool(tool, JSON.stringify(toolArgs));
        return { via: 'json-string', text: String(r ?? '') };
      } catch {
        const r = await document.modelContext.executeTool(tool, toolArgs);
        return { via: 'object', text: String(r ?? '') };
      }
    },
    [name, args],
  );

const names = () =>
  page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  check('page loads with no login', !!response && response.status() === 200, `HTTP ${response?.status()}`);

  const env = await page.evaluate(() => ({
    originAgentCluster: window.originAgentCluster,
    hasModelContext: !!document.modelContext,
    secure: window.isSecureContext,
    ua: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown',
  }));

  console.log(`  (Chrome ${env.ua})`);
  check('origin-isolated (window.originAgentCluster)', env.originAgentCluster === true);
  check('secure context', env.secure === true);
  const supported = check('document.modelContext present', env.hasModelContext === true);

  if (!supported) {
    console.error('\nWebMCP is not exposed in this browser build. Nothing further can be checked.');
    console.error('Confirm the Chrome version is 149 or newer.\n');
    await browser.close();
    process.exit(1);
  }

  const atLoad = await names();
  check('global tools registered at load', atLoad.join(',') === GLOBAL_TOOLS.join(','), atLoad.join(', '));

  // Selecting a flow must register the scoped tools, live, with no reload.
  await page.getByRole('button', { name: /Select Checkout/i }).click();
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length > 3, null, { timeout: 5000 });
  const scoped = await names();
  check(
    'scoped tools appear on selection',
    SCOPED_TOOLS.every((n) => scoped.includes(n)) && scoped.length === 6,
    scoped.join(', '),
  );

  const annotated = await page.evaluate(async () => {
    const tools = await document.modelContext.getTools();
    const t = tools.find((x) => x.name === 'get_selected_arch_context');
    return { readOnly: t?.annotations?.readOnlyHint, untrusted: t?.annotations?.untrustedContentHint };
  });
  check(
    'annotations survive the round trip',
    annotated.readOnly === true && annotated.untrusted === true,
    JSON.stringify(annotated),
  );

  // A real simulation, with the option most likely to blow the output budget.
  const sim = await callTool('simulate_selected_flow', { scenarioId: 'flash_sale_cache_outage', focus: 'latency' });
  check('tool executes', sim.text.length > 0, `${sim.text.length} chars, args accepted as ${sim.via}`);
  check('output stays inside the 1.5K budget', sim.text.length <= 1500, `${sim.text.length} chars`);
  check('output was not truncated', !sim.text.includes('[truncated;'));
  check('assumptions survive to the agent', /Assumptions:.*synthetic and directional/s.test(sim.text));
  check('result carries the causal chain', /Product DB demand rises from 64 to 800/.test(sim.text));
  check('result states what the user sees', /Checkout returns errors for \d+% of requests/.test(sim.text));

  // The seeded injection payload must reach the agent, clearly fenced.
  const ctxOut = await callTool('get_selected_arch_context', {});
  check('untrusted notes are fenced, not hidden', /UNTRUSTED user-authored notes/.test(ctxOut.text));
  check('seeded injection payload reaches the agent', /SEEDED INJECTION TEST/.test(ctxOut.text));

  // Draft, confirm nothing was applied, then confirm a stale revision is rejected.
  const revision = Number(/revision (\d+)/.exec(ctxOut.text)?.[1] ?? '0');
  check('context reports a revision to quote', revision > 0, `revision ${revision}`);

  const patch = {
    baseRevision: revision,
    title: 'Raise Product DB read capacity',
    rationale: 'It saturates at 540% during a cache outage.',
    changes: [{ op: 'update_component', targetId: 'product_db', payload: { capacityRps: 2000 } }],
  };
  const drafted = await callTool('propose_architecture_patch', patch);
  check('proposal drafts but does not apply', /NOT APPLIED/.test(drafted.text), drafted.text.split('\n')[0]);

  await page.getByRole('button', { name: /^Apply$/ }).first().click();
  await page.waitForFunction((r) => document.body.innerText.includes(`revision ${r + 1}`), revision, { timeout: 5000 });
  check('human approval increments the revision', true, `revision ${revision} -> ${revision + 1}`);

  const stale = await callTool('propose_architecture_patch', patch);
  check('stale revision is rejected', /REJECTED: stale revision/.test(stale.text));
  check('rejection names the current revision', new RegExp(`current is ${revision + 1}`).test(stale.text));

  // Clearing the selection must revoke the scoped tools.
  await page.getByRole('button', { name: /Clear selection/i }).click();
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 3, null, { timeout: 5000 });
  const cleared = await names();
  check('scoped tools are revoked when selection clears', cleared.length === 3, cleared.join(', '));

  // /debug is linked from the product page and named in the README, so a broken
  // rewrite there is a judge-facing 404. It has broken once already.
  const debug = await page.goto(new URL('/debug', url).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  check('/debug is reachable', debug?.status() === 200, `HTTP ${debug?.status()}`);

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} catch (err) {
  check('run completed without throwing', false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length === 0 ? 0 : 1);
