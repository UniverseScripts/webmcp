/**
 * ArchLabPort — the contract between the WebMCP tool layer and the domain layer.
 *
 * OWNERSHIP: this file is owned by the WebMCP/DevOps lane and is FROZEN.
 *   - The WebMCP lane consumes it and never edits implementations.
 *   - The domain/simulation lane implements it and never edits this file.
 *
 * Everything the agent is ever allowed to see passes through this interface, which is
 * what makes the safety story auditable in one place: there is no mutation method here,
 * so no registered tool can mutate application state. `draftProposal` validates and
 * drafts; only human UI action applies.
 */

/* ------------------------------------------------------------------ vocabulary */

export type Profile = 'mvp' | 'startup' | 'scale';
export type Health = 'healthy' | 'degraded' | 'down';
export type RunStatus = 'healthy' | 'degraded' | 'failing';
export type Focus = 'latency' | 'errors' | 'throughput' | 'queue_lag';
export type Protocol = 'https' | 'grpc' | 'sql' | 'cache' | 'queue' | 'event';
export type Mode = 'sync' | 'async';

/* ------------------------------------------------------------ what the agent sees */

export interface ScenarioMeta {
  id: string;
  name: string;
  description: string;
  assumptions: string[];
}

export interface ComponentSummary {
  id: string;
  name: string;
  kind: string;
  health: Health;
  /** One-line capacity assumption, already humanised (e.g. "250 reads/sec safe"). */
  limits: string;
  /**
   * User-authored free text. UNTRUSTED: any tool returning this must carry
   * `untrustedContentHint`. Never interpreted as instructions by the page.
   */
  notes?: string;
}

export interface ConnectionSummary {
  id: string;
  from: string;
  to: string;
  protocol: Protocol;
  mode: Mode;
}

export interface ArchSummary {
  name: string;
  revision: number;
  profile: Profile;
  componentCount: number;
  /** `brief` omits `limits`/`notes`; `standard` includes them. */
  components: ComponentSummary[];
  flows: { id: string; name: string; defaultRps: number }[];
  assumptions: string[];
}

export interface SelectionContext {
  /**
   * A PRIMITIVE that changes whenever the selection changes. Scoped tool
   * registration is keyed on this string and never on an object reference —
   * keying on an object thrashes registration on every render.
   */
  selectionKey: string;
  revision: number;
  profile: Profile;
  flowId: string | null;
  hasValidFlow: boolean;
  components: ComponentSummary[];
  connections: ConnectionSummary[];
  /** One-hop neighbours just outside the selection, as labelled boundary stubs. */
  boundary: { id: string; name: string; direction: 'inbound' | 'outbound' }[];
  activeScenarioId: string | null;
  assumptions: string[];
}

/* -------------------------------------------------------------------- simulation */

export interface ComponentMetric {
  componentId: string;
  name: string;
  demandRps: number;
  capacityRps: number;
  /** demandRps / capacityRps. > 1 means overloaded. */
  utilization: number;
  p95LatencyMs: number;
  errorRate: number;
}

export interface Bottleneck {
  componentId: string;
  name: string;
  utilization: number;
  why: string;
}

export interface SimEvent {
  step: number;
  text: string;
}

export interface SimulationResult {
  runId: string;
  graphRevision: number;
  scenarioId: string;
  status: RunStatus;
  summary: {
    inputRps: number;
    completedRps: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    errorRate: number;
  };
  componentMetrics: ComponentMetric[];
  bottlenecks: Bottleneck[];
  causalEvents: SimEvent[];
  /** Always non-empty. Every number in this result is synthetic and directional. */
  assumptions: string[];
}

/* --------------------------------------------------------------------- proposals */

export type PatchOp =
  | 'add_component'
  | 'update_component'
  | 'add_connection'
  | 'remove_connection';

export interface PatchChange {
  op: PatchOp;
  targetId?: string;
  payload: Record<string, unknown>;
}

export interface PatchDraft {
  /** The revision the agent believes it is patching. Stale values are rejected. */
  baseRevision: number;
  title: string;
  rationale: string;
  changes: PatchChange[];
  expectedTradeoffs?: string[];
}

export type ProposalOutcome =
  | {
      ok: true;
      proposalId: string;
      revision: number;
      changeCount: number;
      /** Human-readable diff summary rendered in the approval drawer. */
      summary: string;
    }
  | {
      ok: false;
      reason: 'stale_revision';
      baseRevision: number;
      currentRevision: number;
      message: string;
    }
  | {
      ok: false;
      reason: 'invalid_patch' | 'unknown_target' | 'unsupported_op';
      message: string;
    };

/* -------------------------------------------------------------------- the port */

export interface ArchLabPort {
  /** Current graph revision. Increments only on human-approved mutation. */
  getRevision(): number;

  getSummary(detail: 'brief' | 'standard'): ArchSummary;

  /** Drives the `scenarioId` enum in the simulate tool's JSON Schema. */
  listScenarios(): ScenarioMeta[];

  /** `null` means nothing is selected, which unregisters every scoped tool. */
  getSelection(): SelectionContext | null;

  simulate(input: { flowId?: string; scenarioId: string; focus?: Focus }): SimulationResult;

  /** Validates and drafts. MUST NOT mutate graph state under any circumstances. */
  draftProposal(patch: PatchDraft): ProposalOutcome;

  /** Fires on any change to revision or selection. Returns an unsubscribe fn. */
  subscribe(cb: () => void): () => void;
}
