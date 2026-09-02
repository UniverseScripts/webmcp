#!/usr/bin/env node
/**
 * Automated proof that WebMCP actually works at a URL.
 *
 * Drives the real installed Chrome (not a bundled Chromium) with the WebMCP
 * features forced on, then asserts the whole contract end-to-end:
 *
 *   - the document is origin-isolated, without which the API is disabled
 *   - document.modelContext exists
 *   - the two global tools register at load
 *   - selecting a flow registers the three scoped tools, and clearing the
 *     selection unregisters them -- the dynamic behaviour the entry rests on
 *   - a tool actually executes and returns a bounded plain string
 *
 * That last group is the part a human otherwise has to re-check by hand after
 * every deploy, which is exactly the check that gets skipped at 3am.
 *
 * Usage: node scripts/verify-live.mjs [url]           (default: preview server)
 *        node scripts/verify-live.mjs https://... --headed
 */

import { chromium } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4173';
const headed = process.argv.includes('--headed');

// Feature names read out of chrome.dll in the Chrome 150 install: WebMCPSupport
// gates the API, WebMCPTesting is what chrome://flags/#enable-webmcp-testing
// turns on. Forcing them here means the check does not depend on a human having
// flipped a flag in their own profile.
const FEATURES = 'WebMCPSupport,WebMCPTesting';

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

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  check('page loads', !!response && response.status() < 400, `HTTP ${response?.status()}`);

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

  const names = async () => page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());

  const atLoad = await names();
  check('global tools registered at load', atLoad.length === 2, atLoad.join(', '));
  check(
    'globals are the expected two',
    atLoad.join(',') === 'get_architecture_summary,list_simulation_scenarios',
    atLoad.join(', '),
  );

  // Selecting a flow must register the scoped tools, live, with no reload.
  await page.getByRole('button', { name: /Select Checkout/i }).click();
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length > 2, null, { timeout: 5000 });
  const scoped = await names();
  check('scoped tools appear on selection', scoped.length === 5, scoped.join(', '));
  check(
    'scoped set is correct',
    ['get_selected_arch_context', 'simulate_selected_flow', 'propose_architecture_patch'].every((n) => scoped.includes(n)),
    scoped.join(', '),
  );

  const annotated = await page.evaluate(async () => {
    const tools = await document.modelContext.getTools();
    const t = tools.find((x) => x.name === 'get_selected_arch_context');
    return { readOnly: t?.annotations?.readOnlyHint, untrusted: t?.annotations?.untrustedContentHint };
  });
  check('annotations survive the round trip', annotated.readOnly === true && annotated.untrusted === true, JSON.stringify(annotated));

  // Execute a real tool and confirm the return shape and the output budget.
  const exec = await page.evaluate(async () => {
    const tools = await document.modelContext.getTools();
    const tool = tools.find((t) => t.name === 'simulate_selected_flow');
    const args = { scenarioId: 'flash_sale_cache_outage' };
    try {
      const r = await document.modelContext.executeTool(tool, args);
      return { via: 'object', type: typeof r, len: String(r ?? '').length, text: String(r ?? '') };
    } catch {
      const r = await document.modelContext.executeTool(tool, JSON.stringify(args));
      return { via: 'json-string', type: typeof r, len: String(r ?? '').length, text: String(r ?? '') };
    }
  });
  check('tool executes', exec.len > 0, `${exec.len} chars, args accepted as ${exec.via}`);
  check('output stays inside the 1.5K budget', exec.len <= 1500, `${exec.len} chars`);
  check('result carries the causal chain', /Product DB demand rises from 64 to 800/.test(exec.text));

  // Clearing the selection must revoke the scoped tools.
  await page.getByRole('button', { name: /Clear selection/i }).click();
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 2, null, { timeout: 5000 });
  const cleared = await names();
  check('scoped tools are revoked when selection clears', cleared.length === 2, cleared.join(', '));

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} catch (err) {
  check('run completed without throwing', false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length === 0 ? 0 : 1);
