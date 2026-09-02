# CLAUDE.md — Executable ArchitectureLab

Working notes for whoever picks this up next. The README is for judges and users; this file is
for the person editing the code.

## What this is

A WebMCP entry for the **OpenAI WebMCP Challenge** (webmcp.devpost.com). Submissions close
**2026-09-03 13:00 PT** = 2026-09-04 03:00 local (UTC+7).

Live: https://architecturelab.vercel.app · Debug: https://architecturelab.vercel.app/debug
Repo: github.com/UniverseScripts/webmcp · Vercel: `asteriostech-projects/architecturelab`

Three people, three lanes. **This repo currently contains only lane 2.**

| Lane | Owner | Surface |
|---|---|---|
| 1 — Product UI | QuanTon | canvas, inspector, proposal drawer → `src/components/` (does not exist yet) |
| 2 — WebMCP, safety, testing, deploy | **us** | `src/webmcp/`, `src/contracts/`, `src/debug/`, `scripts/`, deploy, README |
| 3 — Domain, simulation, submission | Tuong | real graph + simulator behind `ArchLabPort`, Devpost text, video |

Planning docs live in `../planning/`. **`../planning/tuong's idea/` is the shipping concept
(Track A, ArchitectureLab). `../planning/quanton's idea/` is discarded — ignore it.**
`../planning/execution plan/` is this lane's brief; it is largely accurate but see "corrections"
below.

## Rule zero: your training data on WebMCP is probably wrong

The API moved during 2026 and models still emit the old surface. Everything in the next section
was verified against **the Chrome 150 binary itself** and by driving a real browser — not from
docs and not from memory. Where this file and your prior knowledge disagree, this file wins.

**Dead API names that models still suggest — all four are scanned for by a test:**
`navigator.modelContext` (deprecated; still *works*, only logs a warning, so bad code looks fine),
`provideContext()`, `clearContext()`, `unregisterTool()` (all removed from the spec).

## Verified WebMCP facts

Namespace is `document.modelContext`. Methods: `registerTool`, `getTools`, `executeTool`, plus the
`toolchange` event. **There is no `unregisterTool`** — unregistration is exclusively via aborting
the `AbortSignal` passed at registration (`blink::ModelContext::ToolUnregisterAbortAlgorithm`).

**Chrome 150 throws on each of these** (verbatim error strings from the binary):
- `Tool name cannot be empty.` / `Tool description cannot be empty for tool: `
- `Duplicate tool name: ` — **throws**, and a fast selection change triggers it when
  re-registration races a pending abort
- `Tool inputSchema must have a 'type' property that is a string` / `'type' must be 'object'` /
  `'properties' must be an object if present` / `'required' must be an array if present`
- `Failed to serialize inputSchema … circular references or non-serializable values` — a
  Zod-generated schema can trip this
- `Access to the feature "tools" is disallowed by permissions policy.` — the Permissions Policy
  feature is literally `tools`, default `self`
- `Only secure origins are allowed in the exposedTo list.` — **`exposedTo` exists** and is a real
  registration option, despite being absent from the inherited context doc

**Silent no-op, not a throw:** `Tool 'X' was not registered because its AbortSignal was already
aborted.` React StrictMode's double-invoked effects hit this on every mount. StrictMode is left
**on** deliberately so the adapter's guard stays exercised.

**Annotations: exactly two exist** — `readOnlyHint`, `untrustedContentHint`. No `destructiveHint`,
`idempotentHint`, or `openWorldHint` (those are plain MCP, not adopted here).

**`executeTool` takes a JSON STRING.** Chrome's docs say string; the spec IDL says
`object inputObject`. Live testing settles it: **the object form throws.** `invokeTool` tries the
string first and keeps the object form as a fallback.

**Return shape is a free choice.** `execute` is typed `Promise<any>` and Chrome JSON-stringifies
whatever comes back (`optimization_guide.proto.ScriptToolResult` has a single `result` field). A
plain string and an MCP `{content:[…]}` envelope both work; **we return plain strings** because the
envelope spends part of the 1.5K budget on punctuation. Do not adopt
`GoogleChromeLabs/use-webmcp-tool` — its hook normalises returns *into* the envelope.

**Budgets (Chrome's recommendations, enforced in `adapter.ts`):** description 500, parameter
description 150, name 30 (hard limit is 128), **output 1500**.

**Origin isolation is mandatory** — the API is disabled outright without it. `vercel.json` sends
`Origin-Agent-Cluster: ?1`. An absent header proves nothing either way; only
`window.originAgentCluster` inside the live document is decisive.

**`webmcp-types@0.1.5` omits `executeTool`** even though Chrome ships it — hence the local type
augmentation in `adapter.ts`. The package is ambient globals, not a module, so it is referenced with
`/// <reference types="webmcp-types" />`, not imported.

**Chrome versions:** local install is 150; stable is 152; judges will be ≤152. WebMCP is an origin
trial across 149–156 and ships unflagged in 157. Below 153, unregistering *does* cancel in-flight
executions — that applies to everyone before the deadline.

### Re-deriving these facts

They came from string extraction on the Chrome binary. This is worth repeating when Chrome updates:

```bash
CD="/c/Program Files/Google/Chrome/Application/<version>"
grep -aoE "blink::ModelContext[A-Za-z]*::[A-Za-z_]+" "$CD/chrome.dll" | sort -u
grep -aoE ".{0,400}Tool not found: .{0,400}" "$CD/chrome.dll" | tr -c '[:print:]\n' '\n' | grep -E "[A-Za-z]{4}"
```

Blink feature names `WebMCPSupport` and `WebMCPTesting` came from the same place, and are what
`scripts/verify-live.mjs` forces on the command line so the harness never depends on someone having
flipped `chrome://flags` in their own profile.

## Architecture

```
src/contracts/port.ts     ArchLabPort + ArchLabControls — the frozen seam. Owned here.
src/contracts/index.ts    the ONLY swap point: three bindings + IS_FIXTURE
src/contracts/fixture/    deterministic FlashCart stand-in; delete when lane 3 lands
src/webmcp/adapter.ts     the only file allowed to touch document.modelContext
src/webmcp/tools.ts       the six tool definitions + budget-aware output assembly
src/webmcp/lifecycle.ts   global tools at load, scoped tools keyed on a primitive
src/debug/                /debug — registry, manual invoke, proposals, activity log
scripts/verify-live.mjs   23-check live gate, drives real Chrome
```

**Two invariants that are enforced by tests, not convention:**

1. Nothing outside `adapter.ts` names `document.modelContext`.
2. **Nothing under `src/webmcp/` imports `controls`.** `controls.applyProposal` is the only thing
   in the codebase that mutates the graph, and it sits in the same barrel the tool layer already
   imports `port` from — so the isolation is one import statement away from breaking. There is also
   a test that runs every tool against the worst-case scenario and asserts the simulation is
   byte-identical afterwards.

**Tool bodies must read through `port.*` at execute time**, never close over state captured at
registration. Registration effects must key on a **primitive** (`selectionKey`), never an object
reference.

**Output must be assembled to fit the budget, not truncated.** `capOutput` cuts from the end, and
the end is where the assumptions block lives — so truncation silently deletes "every number is
synthetic and directional" from precisely the most detailed answers. `assemble()` in `tools.ts`
drops optional sections and keeps essential ones instead.

## Commands

```bash
npm test                                              # 28 guardrail tests
npm run build                                         # tsc -b && vite build (strict)
npm run lint                                          # oxlint, must stay at 0 warnings
node scripts/check-origin-isolation.mjs <url>         # response headers
node scripts/verify-live.mjs <url> [--headed]         # 23 checks, real Chrome
vercel deploy --prod --yes                            # production
```

`verify-live.mjs` **requires an explicit URL**. Localhost passing is not evidence — see below.

## Things that have already broken once

- **Vercel Authentication was on by default** for this team, 302'ing every deployment to
  `vercel.com/sso-api`. Judges — and the ChatGPT in-app browser — would have hit a login wall.
  Disabled via `PATCH /v9/projects/<id>` with `ssoProtection: null`. **Re-check after any project
  setting change.** (The MCP Vercel plugin 404s on this project; use the REST API with the CLI's
  token from `%APPDATA%/xdg.data/com.vercel.cli/auth.json`.)
- **`/debug` 404'd in production.** Vite emits `debug.html`; `cleanUrls: true` in `vercel.json`
  handles the rewrite. `verify-live.mjs` now asserts it.
- **The budget test was tautological** — `capOutput(out).length <= LIMIT` is true by construction.
  Two real calls were overflowing behind it. Assert on **raw** output length.
- **Applying a proposal changed nothing** — the graph was a module const, so re-simulating after
  approval returned identical numbers. It is a working copy now.
- **A parameter description told the agent to call another tool first** — the flow-control checker
  only inspected tool descriptions, not parameter descriptions. It checks both now.

## Style

Match the surrounding code: comments explain *why*, especially where a line defends against a
non-obvious browser behaviour. Prefer a test over a comment when the claim is checkable. Never
claim something in the README that the code does not do — three audits caught exactly that, and a
judge testing a false claim costs more than a missing feature.

## Not ours, still needed

- **Demo video** — mandatory, <3 min, public YouTube, with audio. Missing it is disqualification.
- **Eligibility check** — residency against OpenAI's supported-countries list, all three members.
- **ChatGPT desktop app testing** — the client the rules name first, not installed on this machine.
- Judging is four equally weighted criteria: **WebMCP Leverage, Execution, Potential Impact,
  Creativity & Ambition** (the team spec cites a different, older five-item list).
