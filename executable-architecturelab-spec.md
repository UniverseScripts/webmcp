# Executable ArchitectureLab

> **A WebMCP-native architecture studio where an engineer and their agent co-design a system, run it against traffic and failures, and turn the result into an explainable architecture—not a static diagram.**

**Hackathon:** OpenAI WebMCP Challenge 2026  
**Product type:** Browser-based architecture modelling and lightweight simulation  
**Status:** Competition-ready product specification / build plan  
**Primary audience:** Software engineers, engineering students, technical founders, and solution architects

---

## 1. The idea in one sentence

**Executable ArchitectureLab lets a person and their in-browser AI agent collaboratively build a semantic system diagram, simulate a request through it under load or failure, and inspect exactly why the design succeeds or breaks.**

### Short pitch

Most architecture tools stop at boxes and arrows; most AI assistants stop at advice. ArchitectureLab makes the diagram executable: the human shapes intent and trade-offs while the agent has structured, context-aware tools to inspect, propose, simulate, and explain the *same live architecture*.

### The moment that sells it

A student highlights only the checkout path on a busy canvas and asks their agent: “Will this survive a 10× flash sale if Redis fails?” The agent receives the selected graph—not a screenshot or guessed DOM—runs a simulation, animates the overloaded database connection pool, and proposes an asynchronous order queue. The proposed change appears as a reviewable diff; only the person can apply it.

---

## 2. Problem

Architecture work is split across tools that do not share meaning or live context:

- A whiteboard or diagram editor captures a picture, not operating assumptions.
- An LLM can explain patterns, but normally has to infer the architecture from a screenshot, prose, or a brittle DOM.
- A simulator can expose cause and effect, but it is usually a separate specialist tool and requires tedious manual setup.
- During a design review, people need to understand *this request path*, *this workload*, and *this failure*, not receive a generic distributed-systems lecture.

That separation creates a recurring failure mode: an engineer drafts a plausible diagram, asks an agent for guidance, manually translates advice into edits, and still cannot visibly test whether the architecture works. The diagram becomes documentation; it does not become an engineering conversation.

### Jobs to be done

When I am...

- **learning system design**, help me see causal consequences of design choices instead of memorising component lists.
- **a startup engineer under time pressure**, help me create a defensible first architecture and identify its first bottleneck.
- **reviewing a design**, help me explore a narrow flow and compare alternatives without derailing the whole meeting.
- **explaining a system**, help me turn a diagram into an interactive, inspectable story.

### Design principle

This is deliberately **not** a cloud-capacity planner, a production observability system, or a cycle-accurate discrete-event simulator. It is an educational, directional “what happens if?” tool that makes assumptions visible. The output is evidence for discussion, not approval to deploy.

---

## 3. Target users and personas

### Priya — CS student / interview learner

Priya knows the names of caches, queues, and replicas but cannot predict how they interact. She needs immediate visual feedback, plain-language explanations, and a safe way to try imperfect designs.

**Success:** She can explain why a queue protects checkout during a spike and can compare two designs in one session.

### Mateo — early-stage startup engineer

Mateo is building a marketplace MVP with a tiny team. He wants the smallest architecture that fits a stated load and can grow without an expensive rewrite.

**Success:** He starts from an MVP profile, models one realistic workflow, identifies the initial limiting component, and leaves with a concise decision record.

### Amara — staff engineer / design reviewer

Amara needs to challenge the risky part of a proposal quickly. She needs a focused view of one request path, visible model assumptions, and a reviewable AI proposal rather than agent-authored architecture changes.

**Success:** She can select the payment flow, test a regional dependency outage, and accept or reject a scoped mitigation with a clear rationale.

### Optional demo persona — technical founder

The founder can describe a product in ordinary language and receive a realistic first draft, then learn through guided choices rather than a blank canvas.

---

## 4. Market and competitor landscape

The category is real and crowded, which is an advantage: ArchitectureLab does not need to persuade people that diagrams, modelling, or simulation matter. It must clearly own the gap between them.

### Diagram and modelling tools

- **draw.io / diagrams.net** is the broad, free diagram editor. It offers a security-first approach where its online editor does not store diagram data, plus general drawing/whiteboard capabilities. It is excellent for manually producing diagrams, but a connector is not automatically a semantic dependency, and the diagram has no built-in request economics or agent-visible action model. [draw.io features](https://www2.drawio.com/features)
- **Eraser** generates editable technical diagrams from prompts, files, and repositories; it supports diagram-as-code, agent integrations/MCP, codebase diagrams, and CI-based diagram updates. It is the strongest “AI diagrams from code” comparison. ArchitectureLab does not compete on rendering a diagram from a repo; it competes on a shared, executable runtime model and agent-mediated inspection/simulation inside the browser. [What is Eraser?](https://docs.eraser.io/what-is-eraser) · [Eraser codebase diagrams](https://docs.eraser.io/codebase-diagrams)
- **IcePanel** is a mature architecture-modelling product with C4-oriented drill-down, current/future design branches, and message flows. Its strength is a maintained architecture source of truth for teams. ArchitectureLab's differentiator is a fast, agent-native simulation loop for a selected live flow rather than a comprehensive long-lived enterprise modelling workflow. [IcePanel](https://icepanel.io/)
- **Glideflow** makes architecture diagrams live and embeddable with animated packets, prompt generation, and a remote MCP server that can create/update/publish flows. Its key idea—motion makes direction intelligible—validates ArchitectureLab's animated request trace. Glideflow’s public product story is diagram creation/publishing; ArchitectureLab adds semantic component behavior, scenario parameters, failure modes, in-browser WebMCP context, and human-approved diffs. [Glideflow](https://glideflow.pro/)

### Simulation and learning tools

- **Mutexmachine / Interactive System Design Simulator** is a browser-based learning simulator with deterministic traffic, incidents, capacity, cost, and on-call scenarios. It strongly validates the demand for architecture-as-simulation. ArchitectureLab should not pretend this capability does not exist; its wedge is collaborative *human + agent* work on the same editable architecture via WebMCP. [Mutexmachine](https://www.mutexmachine.com/)
- **SyDe** positions itself as visual system design and real-time simulation, including compilation of topology/dependencies to prepare an architecture for simulation. This is a useful proof that simulation is a legitimate category; it also raises the bar on visual clarity. [SyDe](https://syde.cc/)
- **Smokestack** explicitly presents itself as collaborative system design for humans and AI agents with interactive diagrams and simulation results. Treat it as the closest conceptual signal, not a reason to imitate it. ArchitectureLab should concentrate on a visibly better **WebMCP handoff**: selection-aware tools, dynamic tool surface, structured state, and approval-gated architecture mutations. [Smokestack](https://smokestack.dev/)
- **Systemizer** and similar open-source projects model data flow in distributed systems. They validate the semantic-graph approach, but the hackathon demo should lead with a polished browser collaboration experience, not feature parity with a full simulator. [Systemizer](https://github.com/honzaap/Systemizer)

### What this landscape says

Existing products already cover: free drawing, C4 modelling, AI generation, remote MCP access, animated packets, code-derived diagrams, and richer simulations. Therefore the competition entry must **not** be “AI draws system architecture.”

The defensible thesis is:

> Existing tools generally make an agent a detached author or API client. ArchitectureLab makes the browser page a shared workbench: the agent discovers a *safe, scoped, dynamic representation of the person’s current architectural attention* and collaborates visibly under human control.

### Competitive position

ArchitectureLab is a narrow integration of three things that are usually separate:

1. A semantic architecture graph, not merely shapes and lines.
2. A lightweight executable simulation that exposes assumptions and causal chains.
3. WebMCP tools whose availability and inputs are driven by the exact live page/selection state.

---

## 5. Why WebMCP is essential—not decorative

WebMCP is a proposed web standard for exposing structured page tools to agents. Rather than asking an agent to scrape and interpret a changing visual interface, the site declares tools, JSON-Schema inputs/outputs, and live state. Chrome’s documentation explicitly frames this as a way to improve the efficiency, reliability, and completion of agent tasks, while keeping execution visible in the web experience. [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)

For ArchitectureLab, that changes the product interaction:

| Without WebMCP | With WebMCP |
|---|---|
| The agent reads a screenshot or a DOM and guesses which boxes form “checkout.” | `get_selected_architecture_context` returns the canonical selected subgraph, component properties, active profile, and constraints. |
| The agent guesses whether a simulation completed and must parse animated UI. | `run_simulation` returns structured scenario results, bottlenecks, and causal events. |
| The agent’s edits are indirect UI actions or vague instructions. | `propose_architecture_patch` creates a named, typed, reviewable patch that the page renders as a diff. |
| Every possible action is exposed all the time. | Selection/state changes register the few tools that make sense right now, reducing ambiguity. |
| The human loses the application’s visual context. | Tool execution is visibly reflected in the canvas, event timeline, inspector, and proposal tray. |

The WebMCP portion is not a chatbot bolted onto a diagram editor. It is the bridge that lets an external agent work against **the same versioned, scoped, user-visible architecture state** as the human.

### WebMCP implementation stance

- Use the **Imperative API** (`document.modelContext.registerTool`) because the app needs simulation, selection-aware state, proposal diffs, and approval interaction—not just form filling.
- Register a small set of global read-only tools at application load.
- Dynamically register/revoke scoped tools when the user selects a valid flow or one/more components.
- Keep tool descriptions concise and outputs bounded. Chrome’s security guidance recommends limits such as 500 characters for a description and 1.5K characters per individual tool output. [WebMCP tool security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- Make all agent operations visible and reproducible in an activity log.

### Challenge fit and submission constraints (current as of 1 September 2026)

The official challenge asks for a WebMCP-powered web application that explores a future where people and agents interact, collaborate, and create together. Judges evaluate usefulness, originality, execution, thoughtful WebMCP use, and human-agent experience. [OpenAI challenge page](https://openai.com/webmcp-challenge/)

The Devpost rules require a live URL accessible in ChatGPT’s in-app browser or Chrome with WebMCP enabled, a public open-source repository with a visible license, an explanation of WebMCP fit/UX/human-agent capabilities/implementation, and a public YouTube demo under three minutes with audio. The stated submission deadline is **3 September 2026, 1:00 p.m. PT**. [Official rules](https://webmcp.devpost.com/rules)

### Submission compliance checklist

- [ ] Public deployed HTTPS URL works in ChatGPT’s in-app browser.
- [ ] Confirm `document.modelContext.registerTool(...)` executes in the live deployment.
- [ ] Public repository includes all source, setup, sample data, and an OSI license (MIT recommended).
- [ ] README explicitly distinguishes hackathon-period work if any code predates the event.
- [ ] A no-login demo route has deterministic starter scenarios.
- [ ] Public YouTube video is under 3:00, has spoken audio, and visibly shows WebMCP-powered collaboration.
- [ ] Devpost description directly answers all four required explanatory prompts.
- [ ] No unlicensed logos, music, copyrighted media, or third-party data is used.

---

## 6. Product vision

### Vision

ArchitectureLab becomes the place where architecture is a living, collaborative model: humans retain judgment; agents contribute structured analysis, alternatives, and simulations; every conclusion remains inspectable.

### Product promise

“Ask what happens. See why. Change it deliberately.”

### Core loop

1. **Frame** — choose a profile or describe a product.
2. **Model** — build or accept a semantic architecture draft.
3. **Focus** — click or lasso a component/flow; the selected scope becomes explicit.
4. **Ask** — converse with an agent that can inspect precisely that context.
5. **Simulate** — run baseline, load, or failure scenarios.
6. **Explain** — animate the request path and surface a causal bottleneck narrative.
7. **Propose** — agent creates a patch; person reviews exact changes.
8. **Decide** — accept/reject the patch and capture a decision note.

---

## 7. Human-agent interaction model

### Roles

- **Human:** Owns the architecture, intent, constraints, and all mutations with material design impact.
- **Agent:** Reads the declared state, runs safe analyses, describes trade-offs, and authors *proposals*, never silent final changes.
- **ArchitectureLab page:** Is the shared environment, canonical state holder, simulation renderer, and policy enforcer.

### Interaction contract

The agent should behave as a precise design collaborator, not an autonomous systems designer.

- It may inspect the selected scope and current simulation.
- It may run read-only/deterministic simulations.
- It may generate a patch with assumptions and predicted impact.
- It must not apply topology changes, alter costs/SLOs, delete components, export a document, or invoke external services without the person’s visible approval.
- It must call out unknowns rather than fabricate capacity, latency, traffic, or availability data.

### Shared-focus workflow: selection → context → agent

1. The user selects `Checkout API → Order DB` or clicks a component.
2. The page derives a bounded **selection context**: selected node/edge IDs, one-hop dependencies, active profile, active scenario, and relevant constraints.
3. A contextual side panel displays exactly what will be shared with the agent.
4. ArchitectureLab registers the selected-scope tools and invalidates stale registrations from the prior selection.
5. The agent calls `get_selected_architecture_context` or `simulate_selected_flow`.
6. Results highlight the same scope on canvas and in the timeline.
7. The agent can return a patch proposal tied to the base graph revision.
8. The person sees a diff, accepts/rejects, or edits it manually.

This is the key WebMCP demo beat: **selection is a first-class shared object, not a visual accident.**

### “Snip” mode

Snip mode lets the user drag a rectangle/lasso over the canvas. It produces a portable `ArchitectureContext` containing the selected subgraph plus an automatically generated boundary summary:

- internal nodes and edges;
- inbound/outbound dependencies as labelled boundary stubs;
- current component behavior and capacities;
- active scenario assumptions;
- graph revision and selection timestamp.

The agent can reason about the snip without access to unnecessary canvas content. This is both a usability feature and a privacy/scope-control feature.

---

## 8. MVP scope

### Must ship

1. **A beautiful functional architecture canvas**
   - Nodes, typed connections, pan/zoom, selection, snip/lasso, inspector.
   - A preloaded “FlashCart” commerce system so a judge never starts from a blank page.

2. **Three architecture profiles**
   - MVP, Startup, Scale; each changes semantic defaults and makes trade-offs visible.

3. **Semantic model, not a drawing model**
   - Every node has type, behavior, capacity, availability, latency, scaling, and failure assumptions.
   - Every edge has protocol, request/async mode, and latency/error characteristics.

4. **One request-flow simulator**
   - Follow a chosen route, compute approximate demand/capacity/latency/error, animate it, and identify the first bottleneck.

5. **Three deterministic scenarios**
   - Baseline traffic.
   - 10× flash sale.
   - Cache outage while flash sale traffic continues.

6. **Real WebMCP integration**
   - Global read-only inspect tools.
   - Dynamic selection-context tool registration.
   - A simulation tool returning structured data.
   - A patch proposal tool with visible human approval.

7. **Human-controlled proposal review**
   - Agent proposal appears as an additive/changed/removed diff.
   - Single clear “Apply proposal” control; reject is the default non-destructive exit.

8. **Decision card/export (local only)**
   - Summarise profile, scenario, outcomes, assumptions, chosen patch, and open risks in Markdown copied to clipboard/downloaded locally.

### Should ship if time remains

- Natural-language scaffold (“design a ticketing system for 5k concurrent users”).
- Side-by-side simulation comparison: before vs proposed patch.
- Guided lesson mode with a score based on constraints (not “correct architecture”).
- Local persistence in browser storage and shareable JSON URL payload.

### Explicitly out of scope for the hackathon

- Real cloud provisioning, Kubernetes generation, Terraform execution, or production telemetry ingestion.
- Claims of cost/performance accuracy suitable for real deployment.
- Authentication, multi-user real-time collaboration, and permissions beyond the demo’s agent-approval model.
- Arbitrary import from production architecture tools.
- An embedded general-purpose chat model; the star is an external agent working through WebMCP.
- A full discrete-event engine, complete queuing theory model, or cycle-accurate modelling.

---

## 9. Architecture profiles

Profiles are presets, not prescriptions. Switching a profile changes defaults, exposes a visible change list, and teaches why complexity was added.

### MVP profile — “prove the product”

**Pattern:** client → CDN/edge → monolith API → relational database; optional object storage.

- Fewer operational pieces and low cognitive overhead.
- One deployable service and one primary data store.
- Expected trade-off: database and monolith become the primary shared bottlenecks; no independent scaling or graceful decoupling.

### Startup profile — “separate the hot path”

**Pattern:** client → CDN → API gateway → services; cache; primary database + read replica; queue + worker; object storage.

- Caches read-heavy data and moves slow side effects (email, invoice, analytics) off the request path.
- Expected trade-off: retries, idempotency, stale reads, queue lag, and observability matter.

### Scale profile — “regional resilience”

**Pattern:** global traffic manager → regional gateways/services; regional cache; event stream; partitioned/multi-region data strategy; asynchronous workers.

- Isolates regions and provides intentional degradation paths.
- Expected trade-off: consistency boundaries, higher cost, operational maturity, and failure modes multiply.

### Profile UX

- Show a “Why this exists” caption on every new component.
- Highlight profile-specific improvements in blue and introduced complexity in amber.
- Offer “step back to MVP” to make incremental architecture visible.

---

## 10. Component catalog

The MVP catalog must be small enough for the simulation rules to be coherent.

### User-facing and routing

- **Client:** request origin; concurrency and request rate source.
- **CDN / Edge:** serves cacheable/static requests; edge hit ratio, fixed latency, bypass rules.
- **Load balancer / API gateway:** routes requests; target capacity, routing overhead, health behavior.

### Compute

- **Monolith / API service:** synchronous request handler; replicas, concurrency per replica, service time, error rate.
- **Worker:** asynchronous consumer; concurrency, processing time, retry behavior.
- **Serverless function (stretch):** concurrency ceiling and cold-start penalty.

### State and messaging

- **Cache:** hit ratio, TTL, capacity, availability, miss penalty.
- **Relational database:** connection pool, queries per request, max query throughput, replication role, service time.
- **Document/key-value store (stretch):** partition capacity and eventual-consistency annotation.
- **Queue / event bus:** producer rate, consumer rate, backlog, retention, delivery semantics label.
- **Object storage:** read/write latency and availability abstraction.

### Reliability and control

- **Circuit breaker (logical):** failure threshold and fallback mode.
- **Rate limiter (logical):** allowed RPS and shed policy.
- **External dependency:** fixed latency/error/availability; cannot be modified by the agent except as a proposed wrapper/fallback.

### Component-card vocabulary

Each inspector card should say:

> **Does:** what it does in this system.  
> **Demand:** what arrives here in the selected scenario.  
> **Limit:** what is assumed to be safe.  
> **When overloaded:** deterministic degradation rule.  
> **Trade-off:** why this component exists and what it costs in complexity.

---

## 11. Semantic architecture data model

The UI canvas is a projection of the semantic graph. Never make node position or icon choice the source of architectural truth.

### Core entities

```ts
type Architecture = {
  id: string;
  name: string;
  revision: number;
  profile: "mvp" | "startup" | "scale";
  assumptions: Assumption[];
  components: Component[];
  connections: Connection[];
  flows: RequestFlow[];
  layout: Record<string, { x: number; y: number }>;
};

type Component = {
  id: string;
  name: string;
  kind: ComponentKind;
  behavior: ComponentBehavior;
  tags: string[];
  owner?: string;
  health: "healthy" | "degraded" | "down";
  config: CapacityConfig;
  failureModes: FailureMode[];
  notes?: string;
};

type Connection = {
  id: string;
  from: string;
  to: string;
  protocol: "https" | "grpc" | "sql" | "cache" | "queue" | "event";
  mode: "sync" | "async";
  baseLatencyMs: number;
  errorRate: number;
  enabled: boolean;
};

type RequestFlow = {
  id: string;
  name: string;
  entryComponentId: string;
  steps: FlowStep[];
  defaultRps: number;
  payloadClass: "small" | "medium" | "large";
};

type FlowStep = {
  componentId: string;
  viaConnectionId?: string;
  operation: "read" | "write" | "compute" | "enqueue" | "consume";
  fanout?: number;
  optional?: boolean;
};
```

### Capacity and behavior fields

```ts
type CapacityConfig = {
  replicas?: number;
  maxRps?: number;
  maxConcurrent?: number;
  serviceTimeMs?: number;
  connectionPool?: number;
  cacheHitRatio?: number;
  consumerRps?: number;
  availability?: number; // 0..1; scenario default is an assumption, not a measurement
  retryPolicy?: { maxAttempts: number; backoffMs: number };
  fallback?: "fail" | "serve_stale" | "enqueue" | "shed";
};
```

### Invariants

- `revision` increments for every accepted graph mutation; WebMCP proposals include a `baseRevision` and are rejected/rebased when stale.
- Every connection references existing components and has exactly one mode.
- Every flow has a valid path and an explicit synchronous user-facing segment.
- Every default number is labelled `assumption` in UI and tool output.
- A simulator run is immutable and stores its input revision, scenario, parameters, seed, and generated events.
- A proposal may never silently add undeclared external integrations or remove a component without a human confirmation screen.

### Example: FlashCart baseline (seed architecture)

```text
Browser → CDN → API Gateway → Checkout API → Redis cache → Product DB
                                  │
                                  ├──────────────→ Order DB
                                  │
                                  └──────────────→ Order Queue → Invoice Worker → Email provider
```

The primary demo flow is `place order`: Browser → CDN → Gateway → Checkout API → cache/Product DB lookup → Order DB write → enqueue invoice. The email provider is intentionally off the critical user response path.

---

## 12. Request-flow simulation model

### Goal

Provide a fast, deterministic, understandable directional model. It must be plausible enough to teach architecture trade-offs but visibly constrained enough not to claim operational truth.

### Inputs

- Architecture graph revision and selected `RequestFlow`.
- Scenario: traffic multiplier, duration, component faults, cache state, deployment/event toggles.
- Per-component behavior/capacity assumptions.
- Optional user constraints: SLO target, budget band, maximum data loss tolerance.
- Fixed seed for repeatable demo outputs.

### Output

```ts
type SimulationResult = {
  runId: string;
  graphRevision: number;
  scenario: Scenario;
  status: "healthy" | "degraded" | "failing";
  summary: {
    inputRps: number;
    completedRps: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    errorRate: number;
  };
  componentMetrics: Record<string, ComponentMetric>;
  bottlenecks: Bottleneck[];
  causalEvents: SimulationEvent[];
  assumptions: string[];
};
```

### Simple deterministic mathematics

For every synchronous component in the flow:

```text
effectiveRps = upstreamCompletedRps × fanout × missMultiplier × retryMultiplier
capacity = replicas × maxRps (or a component-specific ceiling)
utilization = effectiveRps / capacity
```

For cacheable reads:

```text
databaseRps = cacheIncomingRps × (1 - cacheHitRatio)
```

For a queue:

```text
backlog(t+1) = max(0, backlog(t) + producedEvents - consumedEvents)
lagSeconds ≈ backlog / max(consumerRps, 1)
```

Directional latency approximation:

```text
stepLatency = networkLatency + serviceTimeMs + queuePenalty(utilization)
queuePenalty(u) = 0                    when u ≤ 0.70
                = 50 × (u - 0.70)/0.20 when 0.70 < u ≤ 0.90
                = 50 + 450 × (u - 0.90)/0.10 when u > 0.90
```

If utilization exceeds 1.0, apply the component’s overload behavior:

- `fail`: reject the excess and propagate an error to sync callers.
- `shed`: intentionally reject/signal 429 at the edge.
- `serve_stale`: return stale cache data if allowed.
- `enqueue`: acknowledge and defer an async action, with queue lag reported.

The model’s value is the *causal graph* and consistent comparison. It is not a claim that p95 latency equals production p95.

### Causal explanation generator

Rather than merely report “p95 = 1.8s,” record structured events:

```text
1. Flash-sale multiplier raises Place Order demand from 80 to 800 RPS.
2. Redis is unavailable; cache hit ratio falls from 0.92 to 0.
3. Product DB demand rises from 64 to 800 reads/sec.
4. Product DB safe capacity is 250 reads/sec; utilization reaches 320%.
5. Checkout API retries two failed reads, increasing DB demand further.
6. Checkout errors increase; order queue remains healthy because it is downstream.
```

The visual timeline uses exactly these structured facts; the agent’s prose explanation is grounded in them.

---

## 13. Load and failure scenarios

### Demo scenarios

**Baseline — normal launch**

- 80 checkout RPS, 92% cache hit ratio, healthy dependencies.
- Expected output: stable response path, low database load, queue clears.

**Flash sale — 10× traffic**

- 800 checkout RPS for 60 simulated seconds.
- Expected output: startup profile stays within API capacity but approaches queue/DB thresholds; MVP profile exposes the database bottleneck.

**Flash sale + cache outage**

- Same traffic; Redis availability becomes zero; cache fallback is `fail` or direct DB read depending on the profile.
- Expected output: cache misses overload the Product DB, latency climbs, retries amplify demand. The agent proposes a controlled mitigation.

### Stretch scenarios

- Slow external payment provider: circuit breaker and asynchronous reconciliation.
- Worker outage: order response remains healthy but invoice queue lag rises.
- Database write pressure: accept queue-backed command, report eventual confirmation semantics.
- Regional outage: route traffic to a secondary region, show capacity/cost trade-off.

### Failure principles

- Every scenario must identify **what failed**, **what the user sees**, **what remains healthy**, and **what mitigation changes**.
- Never say “high availability” without modelling a concrete redundancy/failover behavior.
- Never automatically claim eventual consistency is acceptable; expose it as a human business choice.

---

## 14. Dynamic WebMCP tool design

### Tool registration lifecycle

```mermaid
sequenceDiagram
    participant H as Human
    participant P as ArchitectureLab Page
    participant W as WebMCP Registry
    participant A as External Agent

    H->>P: Select checkout flow / snip subgraph
    P->>P: Build bounded ArchitectureContext
    P->>W: Revoke stale scoped tools
    P->>W: Register selected-context tools
    A->>W: Discover current page tools
    A->>P: get_selected_architecture_context()
    P-->>A: Revisioned graph + scenario + constraints
    A->>P: simulate_selected_flow(scenario)
    P->>P: Run deterministic simulator, render animation
    P-->>A: Structured result + assumptions + bottlenecks
    A->>P: propose_architecture_patch(...)
    P-->>H: Render proposal diff; request approval
    H->>P: Accept or reject
    P->>P: Apply only if accepted; increment revision
```

### Global tools (registered on page load)

#### `get_architecture_summary`

**Purpose:** Return the high-level architecture, profile, assumptions, flow names, graph revision, and safe capabilities.

**Safety:** Read-only. Returns a bounded summary, not every note/hidden property.

```json
{
  "name": "get_architecture_summary",
  "inputSchema": {
    "type": "object",
    "properties": { "detail": { "enum": ["brief", "standard"] } },
    "required": []
  }
}
```

#### `list_simulation_scenarios`

**Purpose:** List available deterministic scenarios and their stated assumptions.

**Safety:** Read-only.

#### `get_component_catalog`

**Purpose:** Describe available component types, their fields, and the simulator behaviors they support.

**Safety:** Read-only. Allows the agent to make grounded proposals without inventing unsupported primitives.

#### `get_decision_log`

**Purpose:** Return approved decision cards and unresolved risks, excluding free-form private notes by default.

**Safety:** Read-only; use `untrustedContentHint` if user-authored note text is included.

### Contextual tools (registered only when applicable)

#### `get_selected_architecture_context`

**Precondition:** One or more components/edges or a snip exists.

**Purpose:** Return the selection, one-hop boundary, active profile/scenario, revision, and explicit assumptions.

```json
{
  "type": "object",
  "properties": {
    "include": {
      "type": "array",
      "items": { "enum": ["components", "connections", "flows", "metrics", "assumptions"] },
      "maxItems": 5
    }
  },
  "required": []
}
```

#### `simulate_selected_flow`

**Precondition:** A selected scope contains a valid request flow.

**Purpose:** Execute a deterministic baseline/load/failure run on the selected flow and visually animate the same run.

```json
{
  "type": "object",
  "properties": {
    "scenarioId": { "type": "string", "enum": ["baseline", "flash_sale_10x", "flash_sale_cache_outage"] },
    "focus": { "enum": ["latency", "errors", "throughput", "queue_lag"] }
  },
  "required": ["scenarioId"]
}
```

**Safety:** Read-only with respect to architecture state, but it does trigger visible UI effects. Mark with `readOnlyHint: true` and clearly show “Simulation started by agent.”

#### `compare_profile_outcomes`

**Precondition:** A flow is selected.

**Purpose:** Run the same scenario against generated MVP/Startup/Scale variants and return comparison highlights. This does not overwrite the current graph.

#### `propose_architecture_patch`

**Precondition:** A scope is selected and the agent provides a current `baseRevision`.

**Purpose:** Produce a typed *draft proposal* to add/change/remove semantic components/connections or settings.

```json
{
  "type": "object",
  "properties": {
    "baseRevision": { "type": "integer" },
    "title": { "type": "string", "maxLength": 90 },
    "rationale": { "type": "string", "maxLength": 500 },
    "changes": {
      "type": "array",
      "maxItems": 8,
      "items": {
        "type": "object",
        "properties": {
          "op": { "enum": ["add_component", "update_component", "add_connection", "remove_connection"] },
          "targetId": { "type": "string" },
          "payload": { "type": "object" }
        },
        "required": ["op", "payload"]
      }
    },
    "expectedTradeoffs": { "type": "array", "items": { "type": "string" }, "maxItems": 5 }
  },
  "required": ["baseRevision", "title", "rationale", "changes"]
}
```

**Safety:** This tool creates a non-applied patch only. It must never mutate architecture state directly.

### Intentional non-tools

Do **not** register direct `apply_patch`, `delete_component`, `export_to_cloud`, `connect_github`, `provision_infrastructure`, or arbitrary-code tools in the MVP. These would weaken the human-control story and create unnecessary attack surface.

### Pseudocode for registration

```ts
const handles = new Map<string, ToolHandle>();

async function replaceScopedTools(context: ArchitectureContext | null) {
  for (const handle of handles.values()) await handle.unregister();
  handles.clear();
  if (!context?.hasValidFlow) return;

  handles.set("get_selected_architecture_context",
    await document.modelContext.registerTool(selectedContextDefinition(context)));
  handles.set("simulate_selected_flow",
    await document.modelContext.registerTool(simulateDefinition(context)));
  handles.set("propose_architecture_patch",
    await document.modelContext.registerTool(proposalDefinition(context)));
}
```

Actual API handle names may change while WebMCP remains experimental; use the current browser/type definitions during implementation. The key product behavior is stale-scope invalidation and bounded context, not a particular wrapper API.

---

## 15. Human approval boundaries

### No approval required

- Read a safe summary or selected context.
- List component catalog, profiles, scenarios, and accepted decision cards.
- Run a local deterministic simulation.
- Highlight a component/flow and open an inspector.

### Explicit approval required

- Apply any architecture patch or parameter change.
- Delete or replace topology.
- Create a decision card/export file.
- Reveal user-authored notes or share data outside the page.
- Invoke a paid/external API, GitHub, cloud provider, or deployment pipeline (future only).

### Approval UI

The proposal drawer should show:

- A short proposed title and plain-language rationale.
- Exact graph diff: added/changed/removed components and connections.
- New complexity/operational responsibilities.
- Before/after simulation headline.
- `Apply proposal`, `Reject`, and `Edit manually` controls.
- A prominent disclaimer: “Directional simulation; assumptions shown.”

### Human-interaction sequence

```mermaid
sequenceDiagram
    participant A as Agent
    participant P as Page
    participant H as Human
    participant G as Architecture Graph

    A->>P: propose_architecture_patch(baseRevision=12)
    P->>G: Validate schema and revision
    G-->>P: Valid draft, no mutation
    P->>H: Show diff, assumptions, simulation comparison
    H->>P: Apply proposal
    P->>G: Apply atomic patch
    G-->>P: Revision 13
    P-->>A: Proposal accepted; revision=13
```

If the human rejects it, the agent receives a concise outcome but should not retry by making hidden variations. It can ask for direction or explain a smaller alternative.

---

## 16. UI layout

### Desktop composition

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ArchitectureLab | FlashCart | Profile: Startup | Scenario: Flash sale ▾      │
├──────────────┬───────────────────────────────────────┬───────────────────────┤
│ Components   │                                       │ Shared context         │
│ catalog      │       Semantic architecture canvas    │ - Current selection    │
│              │       - live path animation           │ - Assumptions          │
│ Profiles     │       - selection/snipping            │ - Agent activity       │
│ MVP          │                                       │                       │
│ Startup      │                                       │ Proposal review        │
│ Scale        │                                       │ [diff appears here]   │
├──────────────┼───────────────────────────────────────┼───────────────────────┤
│ Inspector    │ Simulation timeline / bottleneck graph │ Metrics / causality    │
└──────────────┴───────────────────────────────────────┴───────────────────────┘
```

### UX principles

- The canvas is the primary surface; no modal-first experience.
- The “Shared context” panel always makes agent visibility legible to the person.
- Scenarios are one click and deterministic; judges should not need to tune a dozen sliders.
- Animated packets are an explanation layer, not decoration: color maps to healthy/degraded/error, and reduced-motion mode switches to step-by-step highlighting.
- Inspector fields distinguish **measured** (none in demo) from **assumed** (all simulation inputs).
- Proposal diff is spatially anchored to the canvas; a new queue visually appears where it will be inserted.

### Accessibility

- Keyboard-selectable nodes/edges and a textual outline tree.
- Canvas focus states, non-color-only status labels, and a reduced-motion preference.
- Readable event timeline and aria-live summary for completed simulations.
- Tool-triggered visual effects also produce text activity entries.

---

## 17. Key user stories / use cases

### A. “Will this survive?”

As Priya, I select checkout, ask the agent to simulate a flash sale, see the database saturate, and learn the causal chain in terms I can explain.

**Acceptance:** Tool is called through WebMCP; same selected path glows; result identifies at least one bottleneck, impact, and assumption.

### B. “Propose, don’t silently redesign”

As Mateo, I ask for a way to protect the checkout request from invoice-email delays. The agent proposes adding a queue/worker; I see latency improves but operational complexity is added, then accept the change.

**Acceptance:** The agent cannot mutate the graph directly; user approval increments graph revision and re-runs the comparison.

### C. “Keep the conversation scoped”

As Amara, I snip the payment section and ask about a provider outage. The agent receives only the relevant subgraph and boundaries, not the unrelated identity/analytics architecture.

**Acceptance:** Context tool output includes selection/boundaries/revision and is visibly echoed in UI.

### D. “Learn profiles through consequences”

As a student, I compare the same flash sale across MVP, Startup, and Scale profiles and understand what each additional component buys me.

**Acceptance:** Profile comparison is non-destructive and highlights at least one benefit and one complexity cost per profile.

### E. “Lead a design review”

As a reviewer, I run baseline and failure scenarios, reject an over-engineered agent proposal, and save the resulting decision note locally.

**Acceptance:** Decision note contains chosen scenario, model assumptions, result, and rejected/accepted rationale.

---

## 18. Non-functional requirements

### Performance

- Initial demo architecture interactive in under 2 seconds on a typical laptop.
- Simulation result begins animating in under 500 ms; complete MVP simulation in under 1 second for ≤50 components.
- Canvas maintains 50–60 FPS during normal pan/zoom and a single path animation.
- Tool outputs stay intentionally compact; detailed data is fetched only by an explicit scoped read.

### Reliability and determinism

- Starter scenarios run fully client-side with a fixed seed and no external service dependency.
- A failed agent/tool call leaves graph state unchanged and produces an actionable activity-log message.
- Graph patches validate atomically; no partially added topology.
- Every result can be replayed by run ID/seed/graph revision.

### Compatibility

- Primary: ChatGPT desktop app in-app browser, where the challenge says WebMCP is available by default.
- Secondary: Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled, as specified by the challenge rules/docs.
- Progressive enhancement: without WebMCP support, the canvas and manual scenario buttons work; an inline banner explains that agent collaboration needs a WebMCP-capable browser.

### Maintainability

- Domain model and simulator are framework-independent TypeScript modules.
- UI layout metadata is kept separate from graph semantics.
- Tool definition/registration layer is isolated behind a small adapter because the standard is experimental.
- Tests cover simulation invariants, patch validation, and stale revision rejection.

---

## 19. Security, safety, and privacy

WebMCP tool security deserves specific design attention. Chrome notes that LLMs are susceptible to indirect prompt injection and advises tool authors to use untrusted-content and read-only hints as appropriate, expose tools only to trusted origins, and keep tool descriptions/outputs concise. [Chrome WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

### Threats and mitigations

- **Indirect prompt injection in component names/notes:** Treat all free-form user content as data. Tool responses mark user-authored text as untrusted, do not execute instructions found in notes, and return safe structured fields by default.
- **Agent overreach:** Expose no direct mutation tool. `propose_architecture_patch` writes an inert draft only; user approval applies it.
- **Stale context:** Bind scoped tools/proposals to `graphRevision` and selection token. Revoke scoped tools on selection change; reject stale patches.
- **Scope creep / privacy:** Snip/context tools return only selected content plus the necessary boundary; exclude unrelated notes and hidden metadata by default.
- **Cross-origin access:** Use an origin-isolated deployment and do not set `exposedTo` except a future explicit allowlist. Chrome documents origin isolation and Permissions Policy requirements for WebMCP; keep `tools` limited to `self`. [WebMCP security and permissions](https://developer.chrome.com/docs/ai/webmcp)
- **Misleading simulation:** Persist and display assumptions, include directional-model disclaimers, and never label synthetic figures “production metrics.”
- **XSS/rendering untrusted labels:** Escape/validate all labels; prohibit HTML in notes and display any markdown as text in the MVP.
- **Third-party data:** None in MVP. Demo has synthetic names, workloads, and numbers.

### Data policy for MVP

- Store architecture/session data in memory plus optional local browser storage only.
- No authentication, telemetry, repository ingestion, or cloud sync is required.
- No architecture data is sent from the app to an external backend during starter-mode simulation.
- WebMCP tool output is limited to the currently active page context, as initiated by the user’s agent.

---

## 20. Success metrics

### Hackathon proof metrics

- A judge can open the live URL and complete the seed demo in under 90 seconds.
- At least three independently visible WebMCP calls work: inspect selected context, run simulation, create proposal.
- Tool execution changes what the user sees without any DOM-scraping choreography.
- A human approval gate is clearly demonstrated before graph mutation.
- Every simulation result displays at least one explicit assumption and one causal event.

### Product metrics for a later pilot

- Time from blank/seed architecture to first simulation.
- Percentage of sessions that use selection context before asking the agent.
- Proposal acceptance vs rejection rate, with rejection reasons.
- Learning gain: before/after ability to explain a simulated bottleneck.
- Design-review usefulness rating and number of decision cards generated.
- False-confidence signal: how often users mark a model assumption as unrealistic (should inform model calibration, not be hidden).

---

## 21. Judging-rubric mapping

### Usefulness

Concrete outcome: an engineer/student understands a specific system path and chooses a trade-off through repeatable scenarios. The app avoids empty-canvas paralysis with FlashCart and profiles.

### Originality

The novelty is a browser page that shares *live, bounded design attention* with an agent—selection/snipping, dynamic tool registration, visible tool executions, simulation, and human-approved graph diffs—not merely AI-generated diagram content.

### Execution

The smallest viable system is polished: deterministic starter scene, instantly legible bottleneck animation, stable tools, fast results, and no login/dependency surprises.

### Thoughtful WebMCP use

WebMCP enables core product behavior: structured discovery, page state, scoped simulation, stale-scope invalidation, and non-destructive proposals. Removing WebMCP makes the core human-agent workflow materially worse.

### Human-agent experience

The person always sees what scope is shared, what the agent did, what the model assumed, and what change is proposed. The person makes consequential choices.

---

## 22. Technical stack recommendation

### Recommended build

- **Framework:** Next.js (App Router) + React + TypeScript.
- **Canvas:** React Flow / XYFlow for nodes, edges, selection, and viewport; custom node renderers for states/metrics.
- **State:** Zustand or a small Redux Toolkit store with immutable graph updates; persist only to localStorage for MVP.
- **Schemas:** Zod as the single source for component, simulation, patch, and WebMCP JSON Schema generation.
- **Simulation:** Pure TypeScript deterministic engine running in a Web Worker if canvas animation competes with UI; no backend required.
- **Charts:** SVG/CSS mini charts and timeline to avoid charting dependency complexity.
- **WebMCP:** `webmcp-types` for type assistance where compatible, wrapped in `lib/webmcp.ts`; imperative `document.modelContext.registerTool` integrations only.
- **Testing:** Vitest for engine/domain; Playwright for manual UI fallback; a documented ChatGPT/Chrome WebMCP smoke-test checklist.
- **Deployment:** Vercel (fastest for Next.js) or Netlify. Set HTTPS, origin isolation headers, and verify in the actual in-app browser.

### Suggested code boundaries

```text
src/
  domain/            # graph types, Zod schemas, profile templates
  simulation/        # pure deterministic engine, events, fixtures
  proposals/         # patch schema, validation, diff calculation
  webmcp/             # adapter, tool definitions, dynamic lifecycle
  store/              # UI state, selection token, revisions
  components/         # canvas, inspector, timeline, proposal drawer
  app/                # routes and composed experience
```

### Important implementation decision

Do not call an LLM from the app for the primary demo. Let the **user’s external agent** reason with the site through WebMCP. It demonstrates the challenge’s central premise, reduces API/key risk, and makes the agent integration observable. A simple optional text “starter prompt” generator can be local/template-driven.

---

## 23. Implementation plan for remaining hackathon time

Assume time is extremely constrained. Optimize for a striking, reliable **one-flow vertical slice**, not a broad architecture platform.

### Phase 0 — 20 minutes: prove the browser contract

- Create a deployed or locally accessible bare page.
- Register one `get_architecture_summary` imperative tool and verify discovery/call in ChatGPT in-app browser.
- Capture the exact working browser/version and keep this page as a fallback branch.

**Exit criterion:** An agent calls a real page tool successfully.

### Phase 1 — 60–90 minutes: model and seed canvas

- Define Zod schemas/types for graph, profile, scenario, simulation result, and patch.
- Hard-code FlashCart Startup graph and three profile templates.
- Render nodes/edges; support click selection and inspector.

**Exit criterion:** A judge can understand the checkout flow visually without agent help.

### Phase 2 — 60–90 minutes: deterministic simulation

- Implement only cache, API service, DB, queue, and worker rules.
- Create fixed baseline/flash-sale/cache-outage fixtures.
- Render path animation, top metrics, bottleneck card, and causal event timeline.

**Exit criterion:** Cache-outage scenario visibly overloads Product DB and explains why.

### Phase 3 — 60 minutes: WebMCP collaboration

- Register summary/scenario catalog tools at load.
- Register scoped context/simulate/proposal tools after selection.
- Build activity log that shows tool name, purpose, result status, and timestamp.
- Validate `baseRevision`; show proposal drawer/diff; make apply button the only mutation path.

**Exit criterion:** Agent can inspect selection, trigger the same simulation, and create a non-applied proposal.

### Phase 4 — 45 minutes: demo polish and safety

- Add “What the agent can see” panel and assumptions labels.
- Make tool output compact, explicit, and deterministic.
- Add no-WebMCP fallback banner and ensure manual buttons work.
- Add reduced-motion path or pause control.

**Exit criterion:** The human-agent collaboration is legible even with no narration.

### Phase 5 — final 45 minutes: deploy, record, submit

- Deploy live URL; test exactly as a judge will.
- Add MIT license, README, WebMCP setup/test steps, and clear demo credentials if used.
- Record under-three-minute YouTube video with audio; include both success and approval moment.
- Complete Devpost response directly against its required questions.

### Cut order if behind schedule

Cut in this order: profile comparison → free-form prompt scaffold → multi-select snip → export → side-by-side results. Do **not** cut real WebMCP, selection context, simulation, or approval diff.

---

## 24. Risks and mitigations

### WebMCP API instability / browser support

**Risk:** WebMCP is experimental, and subtle API/support differences can fail late.

**Mitigation:** Prove one tool in the actual target browser before UI work; isolate adapter code; retain manual UI simulation fallback; keep an exact test checklist. Chrome describes WebMCP as under active discussion, so avoid deep coupling to uncertain helpers. [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)

### Tool discoverability is unclear to judges

**Risk:** The app works manually but judges cannot see why WebMCP matters.

**Mitigation:** In video, show the agent call, the shared-context panel, tool activity log, returned structured result, and proposal approval in one uninterrupted sequence.

### Overbuilding a simulator

**Risk:** Implementing “real” distributed-systems physics consumes the hackathon.

**Mitigation:** Fixed component rules, explicit assumptions, deterministic fixtures, and one compelling failure chain. Directional fidelity beats feature count.

### AI output invents architecture facts

**Risk:** Agent recommends unsupported/unmodelled things or overstates confidence.

**Mitigation:** Component catalog tool, typed patch schema, explicit assumptions, and patch validation. Agent can only propose primitives the app knows.

### Weak differentiation against existing AI diagram products

**Risk:** Judges see “another diagram generator.”

**Mitigation:** Do not lead with prompt-to-diagram. Lead with a person’s selected live path, agent-readable scope, deterministic failure run, and human-approved mitigation.

### Agent-caused unsafe mutation / prompt injection

**Risk:** Untrusted text manipulates agent behavior or agent applies changes without consent.

**Mitigation:** Treat labels/notes as untrusted content, no direct mutation tool, revision-bound patches, origin isolation, and explicit approval only.

### Demo reliability

**Risk:** Agent/model behavior is variable.

**Mitigation:** Use precise demo prompt, deterministic data, limited tools, a visual manual fallback, and screen-record a successful run in advance. The video is required, and judges may rely on it rather than testing. [Devpost rules](https://webmcp.devpost.com/rules)

---

## 25. Future roadmap

### After hackathon: prove the collaboration loop

- Save/share versioned architecture scenarios.
- Add multi-user cursors and a review mode where an agent has a visible identity and comment stream.
- Import/export JSON, Mermaid, and C4/Structurizr-compatible subsets.
- Compare alternatives and preserve decision logs as ADRs.

### Then: improve model fidelity responsibly

- Calibrate component templates against public benchmark profiles.
- Add retries, idempotency, cache stampede, circuit breakers, and regional failover with explicit model documentation.
- Integrate opt-in OpenTelemetry or synthetic traces, clearly separating observed data from assumptions.
- Enable code/config import as a *draft* semantic graph with provenance and review.

### Long-term

- Organization-level component policies and approved architecture patterns.
- Secure integrations with source control and cloud-cost estimates, always proposal/approval-gated.
- A learning curriculum where teachers provide scenario constraints and students explain causal outcomes.
- Agent evaluation suite measuring whether tools make architectural tasks more correct, faster, and safer than UI actuation alone.

---

## 26. README and submission positioning

### README opening

```md
# Executable ArchitectureLab

ArchitectureLab is a WebMCP-native architecture studio where people and AI agents
co-design a semantic system model, simulate request flows under load/failure, and
review changes before they are applied.

It is not an AI diagram generator. Its core experience is a shared live browser
workspace: select a flow, let an agent inspect structured current state, run a
deterministic simulation, and review an explicit patch together.
```

### Required “Why WebMCP?” section

```md
## Why WebMCP

The agent needs the user's current architectural attention, not a screenshot of a
canvas. WebMCP exposes revisioned, selection-scoped architecture context and
simulation tools directly from the page. The agent can inspect the exact selected
flow, trigger a visible deterministic simulation, and create a typed proposal.
The person sees what is shared and must approve every architecture mutation.
Without WebMCP, this would degrade to an agent guessing from UI/DOM state or
giving generic advice detached from the live architecture.
```

### How we implemented WebMCP

```md
## WebMCP implementation

We use the WebMCP Imperative API (`document.modelContext.registerTool`) to register
small structured tools. Read-only app tools are registered on load. When a user
selects or snips a valid request flow, ArchitectureLab dynamically registers tools
for that revisioned scope: inspect context, simulate it, and create a non-applied
patch proposal. On selection changes, stale scoped tools are revoked. Tool outputs
are JSON-schema validated, bounded, and shown in the app activity log.
```

### Suggested Devpost project description

```md
Executable ArchitectureLab turns architecture diagrams into a shared, executable
workspace for people and their agents. Select a checkout flow, ask your agent if it
survives a flash sale and cache outage, then watch the same path animate as the
database saturates. The agent can propose a queue-based mitigation, but the human
reviews the exact graph diff and decides whether to apply it.

WebMCP is essential because the agent uses structured, live page tools rather than
guessing from a diagram UI. The app dynamically exposes only the tools relevant to
the user's current selection: inspect selected architecture context, run a local
simulation, and draft a revision-bound patch. This makes collaboration visible,
scoped, and human-controlled.
```

### Repository checklist

- `README.md`: what it is, 30-second quick start, WebMCP test setup, demo route, limitations, license.
- `LICENSE`: MIT (or another visible OSI-approved license).
- `ARCHITECTURE.md`: semantic graph and simulator assumptions.
- `SECURITY.md`: prompt-injection and approval model.
- `CONTRIBUTING.md`: optional but useful for open-source credibility.
- Screenshots/GIF: initial FlashCart canvas, cache-outage bottleneck, proposal diff.
- A prominent statement that numbers are simulated, directional, and synthetic.

---

## 27. Demo scripts

### 90-second demo script

**0:00–0:08 — Hook**

“Architecture diagrams usually stop at boxes and arrows. Advice from an AI usually stops at words. Executable ArchitectureLab lets you and your agent test the same live design together.”

**0:08–0:22 — Establish the system**

Show FlashCart Startup profile. “This is a checkout system: API gateway, checkout service, Redis cache, product/order databases, and an asynchronous invoice worker. Every box has capacity and failure assumptions—not just a label.”

**0:22–0:37 — Human focus becomes agent context**

Select or snip Checkout → Redis → Product DB. “I’m only interested in this path. The shared-context panel shows exactly what my agent can now inspect.”

Use agent prompt: “Simulate this selected checkout flow under a 10× flash sale with a cache outage. Explain the first failure.”

**0:37–0:56 — WebMCP action and visible result**

Show tool activity: `get_selected_architecture_context`, then `simulate_selected_flow`. “The agent did not scrape the canvas. It called the page’s structured WebMCP tools.”

Animate requests. “With Redis down, product reads jump from 64 to 800 RPS. The database’s assumed safe capacity is 250; checkout retries amplify the failure. The order queue stays healthy because it is downstream.”

**0:56–1:15 — Proposal, not autonomy**

Ask: “Propose the smallest safe mitigation.” Show proposal drawer. “The agent proposes stale-while-revalidate plus edge rate limiting. It cannot apply changes itself. I can see added components, assumptions, and before/after directional results.”

Click Apply.

**1:15–1:30 — Close**

“The value is not an AI-drawn diagram. It is a human and agent sharing the exact live architecture state, testing a trade-off, and making a visible decision together—powered by WebMCP.”

### 3-minute demo script

**0:00–0:18 — Problem + claim**

“A static diagram cannot answer ‘what happens when Redis fails during a flash sale?’ And an AI assistant looking at a screenshot cannot reliably reason about the exact path I mean. ArchitectureLab makes architecture executable and shared between a person and their in-browser agent.”

**0:18–0:40 — Show semantic architecture**

Open FlashCart. Click Product DB. “This is not a drawing object. It has a service-time assumption, a read capacity, a connection-pool limit, failure modes, and dependencies. Edges also know whether they are synchronous or asynchronous.”

**0:40–0:58 — Baseline**

Select `Place Order`. Start baseline manually. “At 80 requests per second, Redis absorbs 92% of product reads, checkout responds in the target range, and the invoice queue drains.”

**0:58–1:18 — Shared selection**

Lasso Checkout, Redis, and Product DB. “This is the critical difference. My selection becomes a bounded, revisioned ArchitectureContext. The panel tells me precisely what the external agent can see.”

Prompt agent: “Inspect the selected context. Run flash sale plus cache outage. What fails first, and what remains healthy?”

**1:18–1:45 — Real WebMCP work**

Show registered tools/activity log. “The agent discovers and calls `get_selected_architecture_context`, then `simulate_selected_flow`. Tool output is structured, not UI guessing. The page runs a deterministic simulation and animates the very same path.”

Walk causal timeline: “Traffic increases from 80 to 800 RPS. Redis goes down. Product DB load rises from 64 to 800 RPS. That exceeds the assumed 250 RPS safe limit. Retry behavior increases it further. The invoice worker is not the cause; it is safely after the order acknowledgement.”

**1:45–2:18 — Human-approved architecture change**

Prompt: “Propose the smallest mitigation that protects customers without pretending this is production-ready.”

Show patch diff. “The agent can only propose supported semantic components. It has drafted rate limiting plus stale reads for product browsing, and it makes the trade-off explicit: some product data can be briefly stale. It cannot silently edit the graph.”

Explain revision/approve. “I apply this typed patch. It moves the graph from revision 12 to 13, and ArchitectureLab runs the same scenario again. The error rate drops, while the decision card records the new complexity and assumption.”

**2:18–2:42 — Profiles and product reach**

Click profile comparison. “The same scenario can be evaluated against MVP, Startup, and Scale profiles. This helps students learn why components exist and helps early teams avoid premature complexity.”

**2:42–3:00 — Challenge fit**

“WebMCP is the product here: it connects a human’s live visual focus to structured agent tools, visible simulations, and approval-gated changes. It makes an architecture conversation collaborative instead of detached. That is Executable ArchitectureLab.”

---

## 28. Final concise pitch

**Executable ArchitectureLab is a WebMCP-native system-design studio where you and your agent share one live architecture model. Select a request path, simulate a traffic spike or outage, watch the causal failure unfold, and review an agent’s proposed fix before anything changes. It turns architecture from a static picture—and AI from generic advice—into an explainable, human-controlled engineering conversation.**

---

## 29. Research sources

- [OpenAI — WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Devpost — Official WebMCP Challenge Rules](https://webmcp.devpost.com/rules)
- [Chrome for Developers — WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome for Developers — WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [WebMCP specification repository](https://github.com/webmachinelearning/webmcp)
- [Eraser — product overview](https://docs.eraser.io/what-is-eraser)
- [Eraser — codebase diagrams](https://docs.eraser.io/codebase-diagrams)
- [IcePanel](https://icepanel.io/)
- [draw.io / diagrams.net features](https://www2.drawio.com/features)
- [Glideflow](https://glideflow.pro/)
- [Mutexmachine — Interactive System Design Simulator](https://www.mutexmachine.com/)
- [SyDe](https://syde.cc/)
- [Smokestack](https://smokestack.dev/)
- [Systemizer](https://github.com/honzaap/Systemizer)

*Research was checked on 1 September 2026. Competitor claims are positioned from their public materials; confirm exact pricing, support, and product behavior before making comparative marketing claims.*
