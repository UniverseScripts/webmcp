/**
 * A deterministic, directional implementation of `ArchLabPort`, seeded with the
 * FlashCart architecture.
 *
 * FIXTURE. This exists so the WebMCP lane can prove five real tools end-to-end on
 * a live URL without blocking on the domain lane. It is swapped out at one call
 * site (`src/contracts/index.ts`) when the real engine lands. It is deliberately
 * small: the simulation rules below are exactly the ones written down in the team
 * spec section 12, no more.
 *
 * Nothing here claims operational truth. Every result carries its assumptions.
 */

import type {
  ArchLabControls,
  ArchLabPort,
  ArchSummary,
  Bottleneck,
  CatalogEntry,
  ComponentMetric,
  ComponentSummary,
  ConnectionSummary,
  PatchChange,
  PatchDraft,
  ProposalOutcome,
  ProposalView,
  ScenarioMeta,
  SelectionContext,
  SimEvent,
  SimulationResult,
} from '../port';
import {
  ARCHITECTURE,
  COMPONENTS,
  CONNECTIONS,
  FLOWS,
  SCENARIOS,
  SYNC_PATH,
  type FixtureComponent,
  type FixtureConnection,
} from './graph';

/* ----------------------------------------------------------------- utilities */

const round = (n: number, dp = 2): number => Number(n.toFixed(dp));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** How long each scenario is assumed to run, for backlog accumulation. */
const SCENARIO_SECONDS = 60;

/**
 * Latency added by queueing as a component approaches saturation. Straight from
 * spec section 12: flat below 70% utilisation, gentle to 90%, then steep.
 *
 * The spec's formula is unbounded, which yields absurd multi-second figures at
 * 5x saturation. It is clamped per hop but allowed to accumulate across hops, so
 * a flow that saturates two components is visibly slower than one that saturates
 * one -- which is the comparison the scenarios exist to teach.
 */
function queuePenaltyMs(u: number): number {
  if (u <= 0.7) return 0;
  if (u <= 0.9) return (50 * (u - 0.7)) / 0.2;
  return 50 + 450 * Math.min((u - 0.9) / 0.1, 1);
}

/**
 * Fraction of demand a component rejects when overloaded.
 *
 * Only `fail` and `shed` components reject. A `serve_stale` cache keeps
 * answering, and an `enqueue` component absorbs the excess into a backlog --
 * that is the whole point of putting work on a queue, and treating it as an
 * error is the misreading the cache-outage lesson exists to correct.
 */
function shedFraction(c: FixtureComponent, demand: number): number {
  if (c.overload === 'enqueue' || c.overload === 'serve_stale') return 0;
  if (c.capacityRps === null || demand <= c.capacityRps) return 0;
  return 1 - c.capacityRps / demand;
}

/* -------------------------------------------------------------------- state */

interface Proposal extends ProposalView {
  changes: PatchChange[];
}

const state = {
  revision: 12,
  /** The working graph. Only `applyProposal` ever writes to it. */
  components: clone(COMPONENTS),
  connections: clone(CONNECTIONS),
  selection: [] as string[],
  activeScenarioId: 'baseline' as string,
  lastRun: null as SimulationResult | null,
  proposals: [] as Proposal[],
  runCounter: 0,
};

const subscribers = new Set<() => void>();
function notify(): void {
  for (const cb of subscribers) cb();
}

/* --------------------------------------------------------------- patch logic */

const UPDATABLE = new Set([
  'capacityRps',
  'cacheHitRatio',
  'serviceTimeMs',
  'consumerRps',
  'name',
  'limits',
  'health',
]);

/**
 * Applies a patch to a COPY of the graph and returns it. Used both to preview a
 * proposal (before/after, nothing committed) and to commit one on human
 * approval. Keeping it pure is what makes those two paths the same code.
 */
function withPatch(
  components: FixtureComponent[],
  connections: FixtureConnection[],
  changes: PatchChange[],
): { components: FixtureComponent[]; connections: FixtureConnection[] } {
  const comps = clone(components);
  const conns = clone(connections);

  for (const change of changes) {
    const payload = (change.payload ?? {}) as Record<string, unknown>;

    if (change.op === 'update_component') {
      const target = comps.find((c) => c.id === change.targetId);
      if (!target) continue;
      for (const [key, value] of Object.entries(payload)) {
        if (UPDATABLE.has(key)) (target as unknown as Record<string, unknown>)[key] = value;
      }
      continue;
    }

    if (change.op === 'add_component') {
      const id = String(payload.id ?? `new_${comps.length + 1}`);
      if (comps.some((c) => c.id === id)) continue;
      comps.push({
        id,
        name: String(payload.name ?? id),
        kind: String(payload.kind ?? 'service'),
        health: 'healthy',
        capacityRps: typeof payload.capacityRps === 'number' ? payload.capacityRps : null,
        serviceTimeMs: typeof payload.serviceTimeMs === 'number' ? payload.serviceTimeMs : 5,
        overload: 'fail',
        limits: String(payload.limits ?? 'Proposed component; capacity assumed'),
      });
      continue;
    }

    if (change.op === 'remove_connection') {
      const i = conns.findIndex((c) => c.id === change.targetId);
      if (i >= 0) conns.splice(i, 1);
      continue;
    }

    if (change.op === 'add_connection') {
      const from = String(payload.from ?? '');
      const to = String(payload.to ?? '');
      if (!comps.some((c) => c.id === from) || !comps.some((c) => c.id === to)) continue;
      conns.push({
        id: `c_new_${conns.length + 1}`,
        from,
        to,
        protocol: (payload.protocol as FixtureConnection['protocol']) ?? 'https',
        mode: (payload.mode as FixtureConnection['mode']) ?? 'sync',
        baseLatencyMs: typeof payload.baseLatencyMs === 'number' ? payload.baseLatencyMs : 2,
      });
    }
  }

  return { components: comps, connections: conns };
}

/* ---------------------------------------------------------------- summaries */

function toSummary(c: FixtureComponent, detail: 'brief' | 'standard'): ComponentSummary {
  const base: ComponentSummary = {
    id: c.id,
    name: c.name,
    kind: c.kind,
    health: c.health,
    limits: detail === 'brief' ? '' : c.limits,
  };
  if (detail === 'standard' && c.notes) base.notes = c.notes;
  return base;
}

/* --------------------------------------------------------------- simulation */

function simulateFlow(
  scenarioId: string,
  components: FixtureComponent[],
  connections: FixtureConnection[],
): SimulationResult {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const flow = FLOWS[0];
  const inputRps = flow.defaultRps * scenario.trafficMultiplier;

  const byId = new Map(components.map((c) => [c.id, c]));
  const redis = byId.get('redis');
  const hitRatio = scenario.cacheHitRatio ?? redis?.cacheHitRatio ?? 0;

  const metrics: ComponentMetric[] = [];
  const events: SimEvent[] = [];
  let step = 0;
  const push = (text: string): void => {
    events.push({ step: ++step, text });
  };

  push(
    scenario.trafficMultiplier === 1
      ? `Steady demand of ${inputRps} rps enters the Place Order flow.`
      : `A ${scenario.trafficMultiplier}x multiplier raises Place Order demand from ${flow.defaultRps} to ${inputRps} rps.`,
  );
  if (scenario.faults.includes('redis') && redis) {
    push(`Redis is unavailable; the cache hit ratio falls from ${(redis.cacheHitRatio ?? 0) * 100}% to 0%.`);
  }

  let carried = inputRps;
  let latencyP95 = 0;
  let latencyP50 = 0;

  const hopLatency = (to: string): number => connections.find((c) => c.to === to)?.baseLatencyMs ?? 0;

  const record = (c: FixtureComponent, demand: number): number => {
    const util = c.capacityRps === null || c.capacityRps === 0 ? 0 : demand / c.capacityRps;
    const penalty = queuePenaltyMs(util);
    const shed = shedFraction(c, demand);
    latencyP95 += hopLatency(c.id) + c.serviceTimeMs + penalty;
    latencyP50 += hopLatency(c.id) + c.serviceTimeMs + penalty * 0.3;
    metrics.push({
      componentId: c.id,
      name: c.name,
      demandRps: round(demand, 1),
      capacityRps: c.capacityRps ?? 0,
      utilization: round(util),
      p95LatencyMs: round(c.serviceTimeMs + penalty, 1),
      errorRate: round(shed, 3),
    });
    return demand * (1 - shed);
  };

  for (const id of SYNC_PATH) {
    const c = byId.get(id);
    if (!c) continue;

    if (id === 'product_db') {
      // Cacheable reads: only misses reach the database. Checkout then retries a
      // failed read once, amplifying demand further -- one fixed-point pass,
      // enough to make the causal story right without pretending to model a real
      // retry storm.
      const base = carried * (1 - hitRatio);
      const firstPassShed = shedFraction(c, base);
      const attempts = byId.get('checkout')?.retry?.maxAttempts ?? 1;
      const amplified = base + base * firstPassShed * (attempts - 1);

      if (hitRatio === 0 && redis) {
        const cachedDemand = round(carried * (1 - (redis.cacheHitRatio ?? 0)), 0);
        push(`Product DB demand rises from ${cachedDemand} to ${round(base, 0)} reads/sec as every read misses the cache.`);
      }
      if (c.capacityRps) {
        push(
          `Product DB safe capacity is ${c.capacityRps} reads/sec; utilisation reaches ${round((base / c.capacityRps) * 100, 0)}% before retries.`,
        );
        if (amplified > base) {
          push(
            `Checkout retries failed reads once, amplifying demand to ${round(amplified, 0)} reads/sec (${round((amplified / c.capacityRps) * 100, 0)}%).`,
          );
        }
      }

      const completedReads = record(c, amplified);
      const readSuccess = amplified === 0 ? 1 : completedReads / amplified;
      carried = carried * readSuccess;
      continue;
    }

    if (id === 'redis') {
      record(c, carried);
      continue; // the cache is not the constraint; it changes what reaches the DB
    }

    const before = carried;
    carried = record(c, carried);
    if (before - carried > 0.5) {
      push(`${c.name} sheds ${round(before - carried, 0)} rps: demand ${round(before, 0)} exceeds its assumed ${c.capacityRps} rps.`);
    }
  }

  const completedRps = carried;
  const errorRate = inputRps === 0 ? 0 : 1 - completedRps / inputRps;

  // What the user actually sees. The spec's failure principles require this
  // explicitly, and without it the chain reports a cause with no consequence.
  if (errorRate > 0.01) {
    push(
      `Checkout returns errors for ${round(errorRate * 100, 0)}% of requests; ${round(completedRps, 0)} of ${inputRps} rps complete.`,
    );
  } else {
    push(`Every request completes; the user sees a normal checkout at p95 ${round(latencyP95, 0)}ms.`);
  }

  // Asynchronous tail. It cannot affect the user response, which is the point.
  const queue = byId.get('order_queue');
  if (queue) {
    const produced = completedRps;
    const drain = queue.consumerRps ?? 0;
    const backlog = Math.max(0, produced - drain) * SCENARIO_SECONDS;
    const lagSeconds = drain === 0 ? 0 : backlog / drain;
    metrics.push({
      componentId: queue.id,
      name: queue.name,
      demandRps: round(produced, 1),
      capacityRps: drain,
      utilization: round(drain === 0 ? 0 : produced / drain),
      p95LatencyMs: queue.serviceTimeMs,
      errorRate: 0,
      lagSeconds: round(lagSeconds, 0),
    });
    push(
      backlog > 0
        ? `Invoice work is off the response path: the queue absorbs ${round(produced, 0)} msg/sec against a ${drain} msg/sec drain, so ${round(backlog, 0)} messages back up and clear about ${round(lagSeconds, 0)}s after the spike. Checkout is unaffected.`
        : `Invoice work stays healthy: the queue drains ${round(produced, 0)} msg/sec well inside its ${drain} msg/sec capacity.`,
    );
  }

  // Only components that actually reject traffic count as bottlenecks. A queue
  // that falls behind produces lag, reported above, not failure.
  const bottlenecks: Bottleneck[] = metrics
    .filter((m) => {
      const c = byId.get(m.componentId);
      return c && c.overload !== 'enqueue' && c.overload !== 'serve_stale' && m.capacityRps > 0 && m.utilization > 0.7;
    })
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 3)
    .map((m) => ({
      componentId: m.componentId,
      name: m.name,
      utilization: m.utilization,
      why:
        m.utilization > 1
          ? `Demand ${m.demandRps} rps exceeds the assumed ${m.capacityRps} rps safe capacity.`
          : `Demand ${m.demandRps} rps is inside the assumed ${m.capacityRps} rps ceiling but past the queueing threshold.`,
    }));

  const maxUtil = Math.max(0, ...bottlenecks.map((b) => b.utilization));
  const status: SimulationResult['status'] =
    errorRate > 0.1 || maxUtil > 1 ? 'failing' : maxUtil > 0.7 ? 'degraded' : 'healthy';

  return {
    runId: `run_${++state.runCounter}`,
    graphRevision: state.revision,
    scenarioId: scenario.id,
    status,
    summary: {
      inputRps: round(inputRps, 0),
      completedRps: round(completedRps, 0),
      p50LatencyMs: round(latencyP50, 0),
      p95LatencyMs: round(latencyP95, 0),
      errorRate: round(errorRate, 3),
    },
    componentMetrics: metrics,
    bottlenecks,
    causalEvents: events,
    assumptions: [...ARCHITECTURE.assumptions, ...scenario.assumptions],
  };
}

/* ----------------------------------------------------------------- catalog */

const CATALOG: CatalogEntry[] = [
  { kind: 'client', does: 'Origin of requests', fields: [] },
  { kind: 'cdn', does: 'Serves cacheable requests at the edge', fields: ['capacityRps', 'serviceTimeMs'] },
  { kind: 'gateway', does: 'Routes requests to services', fields: ['capacityRps', 'serviceTimeMs'] },
  { kind: 'service', does: 'Synchronous request handler', fields: ['capacityRps', 'serviceTimeMs'] },
  { kind: 'cache', does: 'Absorbs reads before they reach a store', fields: ['cacheHitRatio', 'capacityRps'] },
  { kind: 'relational_db', does: 'Durable store with a read/write ceiling', fields: ['capacityRps', 'serviceTimeMs'] },
  { kind: 'queue', does: 'Buffers async work; backs up rather than failing', fields: ['consumerRps'] },
  { kind: 'worker', does: 'Drains a queue asynchronously', fields: ['capacityRps', 'serviceTimeMs'] },
  { kind: 'external', does: 'Third-party dependency, not modifiable', fields: ['serviceTimeMs'] },
];

/* --------------------------------------------------------------------- port */

export const fixturePort: ArchLabPort = {
  getRevision: () => state.revision,

  getSummary(detail): ArchSummary {
    return {
      name: ARCHITECTURE.name,
      revision: state.revision,
      profile: ARCHITECTURE.profile,
      componentCount: state.components.length,
      components: state.components.map((c) => toSummary(c, detail)),
      flows: FLOWS.map((f) => ({ id: f.id, name: f.name, defaultRps: f.defaultRps })),
      assumptions: ARCHITECTURE.assumptions,
    };
  },

  listScenarios(): ScenarioMeta[] {
    return SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      assumptions: s.assumptions,
    }));
  },

  listCatalog: () => CATALOG,

  getSelection(): SelectionContext | null {
    if (state.selection.length === 0) return null;

    const selected = state.selection
      .map((id) => state.components.find((c) => c.id === id))
      .filter((c): c is FixtureComponent => !!c);
    const ids = new Set(selected.map((c) => c.id));

    const internal = state.connections.filter((c) => ids.has(c.from) && ids.has(c.to));
    type Boundary = SelectionContext['boundary'][number];
    const boundary = state.connections.flatMap<Boundary>((c) => {
      const name = (id: string): string => state.components.find((x) => x.id === id)?.name ?? id;
      if (ids.has(c.from) && !ids.has(c.to)) return [{ id: c.to, name: name(c.to), direction: 'outbound' }];
      if (!ids.has(c.from) && ids.has(c.to)) return [{ id: c.from, name: name(c.from), direction: 'inbound' }];
      return [];
    });

    const onSyncPath = selected.filter((c) => (SYNC_PATH as readonly string[]).includes(c.id));

    return {
      selectionKey: `${state.revision}:${[...state.selection].sort().join(',')}`,
      revision: state.revision,
      profile: ARCHITECTURE.profile,
      flowId: onSyncPath.length >= 2 ? FLOWS[0].id : null,
      hasValidFlow: onSyncPath.length >= 2,
      components: selected.map((c) => toSummary(c, 'standard')),
      connections: internal.map<ConnectionSummary>((c) => ({
        id: c.id,
        from: c.from,
        to: c.to,
        protocol: c.protocol,
        mode: c.mode,
      })),
      boundary,
      activeScenarioId: state.activeScenarioId,
      assumptions: ARCHITECTURE.assumptions,
    };
  },

  simulate({ scenarioId, withProposal }): SimulationResult {
    let { components, connections } = { components: state.components, connections: state.connections };

    if (withProposal) {
      const p = state.proposals.find((x) => x.id === withProposal);
      if (p) ({ components, connections } = withPatch(components, connections, p.changes));
    } else {
      // Record the run so the page can show what the agent just did. This writes
      // presentation state only; the graph itself is untouched.
      state.activeScenarioId = scenarioId;
    }

    const result = simulateFlow(scenarioId, components, connections);
    if (!withProposal) state.lastRun = result;
    notify();
    return result;
  },

  /**
   * Validates and drafts. Never mutates the graph -- that is the whole safety
   * argument, and it is enforced here rather than by convention.
   */
  draftProposal(patch: PatchDraft): ProposalOutcome {
    if (patch.baseRevision !== state.revision) {
      return {
        ok: false,
        reason: 'stale_revision',
        baseRevision: patch.baseRevision,
        currentRevision: state.revision,
        message:
          `Proposal targets revision ${patch.baseRevision} but the graph is now at ` +
          `revision ${state.revision}. Re-read the selected context and resubmit.`,
      };
    }

    if (!Array.isArray(patch.changes) || patch.changes.length === 0) {
      return { ok: false, reason: 'invalid_patch', message: 'A proposal must contain at least one change.' };
    }

    if (state.proposals.filter((p) => p.status === 'draft').length >= 5) {
      return {
        ok: false,
        reason: 'invalid_patch',
        message: 'Five drafts are already awaiting review. Ask the user to decide on those first.',
      };
    }

    for (const change of patch.changes) {
      if (change.op === 'update_component' || change.op === 'remove_connection') {
        const known =
          state.components.some((c) => c.id === change.targetId) ||
          state.connections.some((c) => c.id === change.targetId);
        if (!known) {
          return {
            ok: false,
            reason: 'unknown_target',
            message: `Unknown target "${change.targetId ?? '(missing)'}" for ${change.op}.`,
          };
        }
      }
      if (change.op === 'add_component') {
        const kind = String((change.payload as Record<string, unknown>)?.kind ?? '');
        if (kind && !CATALOG.some((e) => e.kind === kind)) {
          return {
            ok: false,
            reason: 'unsupported_op',
            message: `Unknown component kind "${kind}". The simulator only models: ${CATALOG.map((e) => e.kind).join(', ')}.`,
          };
        }
      }
    }

    const proposal: Proposal = {
      id: `prop_${state.proposals.length + 1}`,
      baseRevision: patch.baseRevision,
      title: patch.title,
      rationale: patch.rationale,
      changes: patch.changes,
      expectedTradeoffs: patch.expectedTradeoffs ?? [],
      status: 'draft',
    };
    state.proposals.push(proposal);
    notify();

    return {
      ok: true,
      proposalId: proposal.id,
      revision: state.revision,
      changeCount: patch.changes.length,
      summary: patch.changes.map((c) => `${c.op}${c.targetId ? ` ${c.targetId}` : ''}`).join('; '),
    };
  },

  subscribe(cb): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  },
};

/* -------------------------------------------------------------- UI controls */

/**
 * The human half of the approval boundary. Nothing under `src/webmcp/` may
 * import this, and a test enforces it.
 */
export const fixtureControls: ArchLabControls = {
  setSelection(componentIds: string[]): void {
    state.selection = [...componentIds];
    notify();
  },

  clearSelection(): void {
    state.selection = [];
    notify();
  },

  listProposals: (): readonly ProposalView[] => state.proposals,

  /** The only path that mutates the graph. Human action only. */
  applyProposal(id: string): boolean {
    const p = state.proposals.find((x) => x.id === id && x.status === 'draft');
    if (!p) return false;
    const patched = withPatch(state.components, state.connections, p.changes);
    state.components = patched.components;
    state.connections = patched.connections;
    p.status = 'applied';
    state.revision += 1;
    state.lastRun = null;
    notify();
    return true;
  },

  rejectProposal(id: string): boolean {
    const p = state.proposals.find((x) => x.id === id && x.status === 'draft');
    if (!p) return false;
    p.status = 'rejected';
    notify();
    return true;
  },

  resetToSeed(): void {
    state.revision = 12;
    state.components = clone(COMPONENTS);
    state.connections = clone(CONNECTIONS);
    state.selection = [];
    state.activeScenarioId = 'baseline';
    state.lastRun = null;
    state.proposals = [];
    state.runCounter = 0;
    notify();
  },

  componentIds: (): string[] => state.components.map((c) => c.id),

  isFixture: true,
};

/** The most recent agent- or human-triggered run, for the page to render. */
export const lastRun = (): SimulationResult | null => state.lastRun;
