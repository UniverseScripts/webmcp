#!/usr/bin/env node
/**
 * Pre-flight check for a deployed URL.
 *
 * WebMCP is disabled outright in a document that is not origin-isolated, so this
 * is a functional prerequisite rather than a hardening step.
 *
 * IMPORTANT: this script cannot prove the page is origin-isolated. An absent
 * `Origin-Agent-Cluster` header does not settle it -- Chrome carries a setting
 * for how an absent header is treated, and a page can request origin-keying and
 * still fail to get it. Only `window.originAgentCluster` inside the live
 * document is decisive, which is why this prints that assertion at the end and
 * why /debug shows it.
 *
 * Usage: node scripts/check-origin-isolation.mjs https://your-deployment
 */

const url = process.argv[2];

if (!url) {
  console.error('usage: node scripts/check-origin-isolation.mjs <url>');
  process.exit(2);
}

const INTERESTING = [
  'origin-agent-cluster',
  'permissions-policy',
  'content-security-policy',
  'origin-trial',
  'strict-transport-security',
];

const label = (ok, text) => `${ok ? '  PASS' : '  FAIL'}  ${text}`;

let res;
try {
  res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  // Some hosts do not answer HEAD for static assets.
  if (res.status >= 400) res = await fetch(url, { redirect: 'follow' });
} catch (err) {
  console.error(`Could not reach ${url}: ${err.message}`);
  process.exit(1);
}

console.log(`\n${res.url}  ->  HTTP ${res.status}\n`);

console.log('Headers that matter:');
for (const name of INTERESTING) {
  const value = res.headers.get(name);
  console.log(`  ${name}: ${value ?? '(absent)'}`);
}

const failures = [];

const https = new URL(res.url).protocol === 'https:';
console.log(`\n${label(https, `served over HTTPS (${new URL(res.url).protocol})`)}`);
if (!https) failures.push('not HTTPS: WebMCP requires a secure context');

const oac = res.headers.get('origin-agent-cluster');
const oacOk = oac !== '?0';
console.log(label(oacOk, `Origin-Agent-Cluster is ${oac ?? 'absent'}${oac === '?1' ? ' (explicitly requested)' : ''}`));
if (!oacOk) failures.push('Origin-Agent-Cluster: ?0 disables WebMCP outright');
if (oac !== '?1') {
  console.log('  WARN  header is not "?1". It very likely still works, because Chrome');
  console.log('        defaults to origin-keyed, but set it explicitly and remove the doubt.');
}

const pp = res.headers.get('permissions-policy');
const ppOk = !pp || !/(^|,)\s*tools\s*=\s*\(\s*\)/.test(pp);
console.log(label(ppOk, `Permissions-Policy does not block "tools"`));
if (!ppOk) failures.push('Permissions-Policy denies the "tools" feature');

console.log('\nThis script cannot confirm origin isolation from outside the page.');
console.log('Open the URL in a WebMCP-capable browser and run:\n');
console.log('    window.originAgentCluster === true && !!document.modelContext');
console.log('\nOr just open /debug, which shows both plus the live tool registry.\n');

if (failures.length) {
  console.error('BLOCKING:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('No blocking problems found in the response headers.\n');
