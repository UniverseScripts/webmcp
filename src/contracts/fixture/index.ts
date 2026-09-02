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
  ArchLabPort,
  ArchSummary,
  Bottleneck,
  ComponentMetric,
  ComponentSummary,
  ConnectionSummary,
  PatchDraft,
  ProposalOutcome,
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
} from './graph';

/* ----------------------------------------------------------------- utilities */

const byId = new Map(COMPONENTS.map((c) => [c.id, c]));
const round = (n: number, dp = 2): number => Number(n.toFixed(dp));

/**
 * Latency added by queueing as a component approaches saturation. Straight from
 * spec section 12: flat below 70% utilisation, gentle to 90%, then steep.
 */
function queuePenaltyMs(u: number): number {
  if (u <= 0.7) return 0;
  if (u <= 0.9) return (50 * (u - 0.7)) / 0.2;
  return 50 + (450 * Math.min(u - 0.9, 0.1)) / 0.1;
}

/** Fraction of demand rejected by a component that fails or sheds when overloaded. */
function shedFraction(demand: number, capacity: number | null): number {
  if (capacity === null || demand <= capacity) return 0;
  return 1 - capacity / demand;
}

/* -------------------------------------------------------------------- state */

interface Proposal {
  id: string;
  baseRevision: number;
  title: string;
  rationale: string;
  changes: PatchDraft['changes'];
  expectedTradeoffs: string[];
  status: 'draft' | 'applied' | 'rejected';
}

const state = {
  revision: 12,
  selection: [] as string[],
  activeScenarioId: 'baseline' as string,
  proposals: [] as Proposal[],
  runCounter: 0,
};

const subscribers = new Set<() => void>();
function notify(): void {
  for (const cb of subscribers) cb();
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

function toConnectionSummary(id: string): ConnectionSummary | null {
  const c = CONNECTIONS.find((x) => x.id === id);
  return c
    ? { id: c.id, from: c.from, to: c.to, protocol: c.protocol, mode: c.mode }
    : null;
}

/* --------------------------------------------------------------- simulation */

function simulateFlow(scenarioId: string): SimulationResult {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const flow = FLOWS[0];
  const inputRps = flow.defaultRps * scenario.trafficMultiplier;

  const redis = byId.get('redis')!;
  const hitRatio = scenario.cacheHitRatio ?? redis.cacheHitRatio ?? 0;

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
  if (scenario.faults.includes('redis')) {
    push(`Redis is unavailable; the cache hit ratio falls from ${redis.cacheHitRatio! * 100}% to 0%.`);
  }

  // Walk the synchronous path. Demand carried forward is what the previous hop
  // actually completed, so an overloaded component protects the ones behind it.
  let carried = inputRps;
  let latencyP95 = 0;
  let latencyP50 = 0;
  let maxUtil = 0;

  const record = (c: FixtureComponent, demand: number, hops: number): number => {
    const util = c.capacityRps === null ? 0 : demand / c.capacityRps;
    const penalty = queuePenaltyMs(util);
    const shed = shedFraction(demand, c.capacityRps);
    latencyP95 += hops + c.serviceTimeMs + penalty;
    latencyP50 += hops + c.serviceTimeMs + penalty * 0.3;
    maxUtil = Math.max(maxUtil, util);
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

  const hopLatency = (to: string): number =>
    CONNECTIONS.find((c) => c.to === to)?.baseLatencyMs ?? 0;

  for (const id of SYNC_PATH) {
    const c = byId.get(id)!;

    if (id === 'product_db') {
      // Cacheable reads: only misses reach the database. Then Checkout retries a
      // failed read once, which amplifies demand further -- one fixed-point pass,
      // which is enough to make the causal story right without pretending to
      // model a real retry storm.
      const base = carried * (1 - hitRatio);
      const firstPassShed = shedFraction(base, c.capacityRps);
      const attempts = byId.get('checkout')!.retry?.maxAttempts ?? 1;
      const amplified = base + base * firstPassShed * (attempts - 1);

      if (hitRatio === 0) {
        const cachedDemand = round(carried * (1 - (redis.cacheHitRatio ?? 0)), 0);
        push(`Product DB demand rises from ${cachedDemand} to ${round(base, 0)} reads/sec as every read misses the cache.`);
      }
      push(
        `Product DB safe capacity is ${c.capacityRps} reads/sec; utilisation reaches ${round((base / c.capacityRps!) * 100, 0)}% before retries.`,
      );
      if (amplified > base) {
        push(
          `Checkout retries failed reads once, amplifying demand to ${round(amplified, 0)} reads/sec (${round((amplified / c.capacityRps!) * 100, 0)}%).`,
        );
      }
      const completedReads = record(c, amplified, hopLatency(id));
      // Read failures become checkout failures on the synchronous path.
      const readSuccess = amplified === 0 ? 1 : completedReads / amplified;
      carried = carried * readSuccess;
      continue;
    }

    if (id === 'redis') {
      record(c, carried, hopLatency(id));
      continue; // the cache is not the constraint; it changes what reaches the DB
    }

    const before = carried;
    carried = record(c, carried, hopLatency(id));
    if (before - carried > 0.5) {
      push(`${c.name} sheds ${round(before - carried, 0)} rps: demand ${round(before, 0)} exceeds its assumed ${c.capacityRps} rps.`);
    }
  }

  // Asynchronous tail. It cannot affect the user response, which is the point.
  const queue = byId.get('order_queue')!;
  const produced = carried;
  const drain = queue.consumerRps ?? 0;
  const backlogPerSec = Math.max(0, produced - drain);
  metrics.push({
    componentId: queue.id,
    name: queue.name,
    demandRps: round(produced, 1),
    capacityRps: drain,
    utilization: round(drain === 0 ? 0 : produced / drain),
    p95LatencyMs: queue.serviceTimeMs,
    errorRate: 0,
  });
  push(
    backlogPerSec > 0
      ? `Invoice work is off the response path: the queue absorbs ${round(produced, 0)} msg/sec against a ${drain} msg/sec drain, so backlog grows by ${round(backlogPerSec, 0)}/sec and clears after the spike.`
      : `Invoice work stays healthy: the queue drains ${round(produced, 0)} msg/sec well inside its ${drain} msg/sec capacity.`,
  );

  const completedRps = carried;
  const errorRate = inputRps === 0 ? 0 : 1 - completedRps / inputRps;

  const bottlenecks: Bottleneck[] = metrics
    .filter((m) => m.capacityRps > 0 && m.utilization > 0.7)
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

/* --------------------------------------------------------------------- port */

export const fixturePort: ArchLabPort = {
  getRevision: () => state.revision,

  getSummary(detail): ArchSummary {
    return {
      name: ARCHITECTURE.name,
      revision: state.revision,
      profile: ARCHITECTURE.profile,
      componentCount: COMPONENTS.length,
      components: COMPONENTS.map((c) => toSummary(c, detail)),
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

  getSelection(): SelectionContext | null {
    if (state.selection.length === 0) return null;

    const selected = state.selection.map((id) => byId.get(id)).filter((c): c is FixtureComponent => !!c);
    const ids = new Set(selected.map((c) => c.id));

    const internal = CONNECTIONS.filter((c) => ids.has(c.from) && ids.has(c.to));
    type Boundary = SelectionContext['boundary'][number];
    const boundary = CONNECTIONS.flatMap<Boundary>((c) => {
      if (ids.has(c.from) && !ids.has(c.to)) {
        return [{ id: c.to, name: byId.get(c.to)?.name ?? c.to, direction: 'outbound' as const }];
      }
      if (!ids.has(c.from) && ids.has(c.to)) {
        return [{ id: c.from, name: byId.get(c.from)?.name ?? c.from, direction: 'inbound' as const }];
      }
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
      connections: internal
        .map((c) => toConnectionSummary(c.id))
        .filter((c): c is ConnectionSummary => c !== null),
      boundary,
      activeScenarioId: state.activeScenarioId,
      assumptions: ARCHITECTURE.assumptions,
    };
  },

  simulate({ scenarioId }): SimulationResult {
    state.activeScenarioId = scenarioId;
    const result = simulateFlow(scenarioId);
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

    for (const change of patch.changes) {
      if (change.op === 'update_component' || change.op === 'remove_connection') {
        const known =
          byId.has(change.targetId ?? '') || CONNECTIONS.some((c) => c.id === change.targetId);
        if (!known) {
          return {
            ok: false,
            reason: 'unknown_target',
            message: `Unknown target "${change.targetId ?? '(missing)'}" for ${change.op}.`,
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
      summary: patch.changes
        .map((c) => `${c.op}${c.targetId ? ` ${c.targetId}` : ''}`)
        .join('; '),
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
 * Beyond the port. The agent can never reach these: they are the human-only side
 * of the approval boundary, driven by UI and by the /debug route.
 */
export const fixtureControls = {
  setSelection(componentIds: string[]): void {
    state.selection = [...componentIds];
    notify();
  },
  clearSelection(): void {
    state.selection = [];
    notify();
  },
  listProposals(): readonly Proposal[] {
    return state.proposals;
  },
  /** The only path that mutates the graph. Human action only. */
  applyProposal(id: string): boolean {
    const p = state.proposals.find((x) => x.id === id && x.status === 'draft');
    if (!p) return false;
    p.status = 'applied';
    state.revision += 1;
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
  componentIds: (): string[] => COMPONENTS.map((c) => c.id),
  isFixture: true as const,
};
