/**
 * ArchLabPort — the contract between the WebMCP tool layer and the domain layer.
 *
 * OWNERSHIP: this file is owned by the WebMCP/DevOps lane and is FROZEN.
 *   - The WebMCP lane consumes it and never edits implementations.
 *   - The domain/simulation lane implements it and never edits this file.
 *
 * Everything the agent is ever allowed to see passes through this interface, which is
 * what makes the safety story auditable in one place: **no method here mutates the
 * architecture graph**. `draftProposal` validates and drafts; only human action, through
 * `ArchLabControls` (which the tool layer must never import), applies a patch.
 *
 * Be precise about what that does and does not claim. Two methods here do write
 * *presentation* state: `simulate` records the run so the page can show it, and
 * `draftProposal` appends to the proposal queue. Both are deliberate -- an agent's work
 * is supposed to be visible -- and the spec sanctions marking `simulate` `readOnlyHint`
 * on the grounds that it is read-only *with respect to architecture state*. Neither can
 * change a component, a connection, or the revision.
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
  /**
   * Queue backlog drain time, for components whose overload behaviour is to
   * enqueue rather than fail. Absent on everything else -- an asynchronous
   * component that falls behind produces lag, not errors, and conflating the two
   * is the misreading the whole cache-outage lesson exists to prevent.
   */
  lagSeconds?: number;
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

/** What the component catalog exposes, so the agent proposes only known primitives. */
export interface CatalogEntry {
  kind: string;
  does: string;
  /** Which capacity fields are meaningful for this kind. */
  fields: string[];
}

/* -------------------------------------------------------------------- the port */

export interface ArchLabPort {
  /** Current graph revision. Increments only on human-approved mutation. */
  getRevision(): number;

  getSummary(detail: 'brief' | 'standard'): ArchSummary;

  /** Drives the `scenarioId` enum in the simulate tool's JSON Schema. */
  listScenarios(): ScenarioMeta[];

  /**
   * The component kinds and patch operations the simulator actually understands.
   * Exposing this is what stops an agent proposing primitives that do not exist.
   */
  listCatalog(): CatalogEntry[];

  /** `null` means nothing is selected, which unregisters every scoped tool. */
  getSelection(): SelectionContext | null;

  /**
   * Runs a scenario. Read-only with respect to the architecture graph.
   *
   * `withProposal` simulates the graph *as if* that draft proposal had been
   * applied, without applying it — which is how the approval drawer shows a
   * before/after headline without anything being committed first.
   */
  simulate(input: {
    flowId?: string;
    scenarioId: string;
    focus?: Focus;
    withProposal?: string;
  }): SimulationResult;

  /** Validates and drafts. MUST NOT mutate the architecture graph, ever. */
  draftProposal(patch: PatchDraft): ProposalOutcome;

  /** Fires on any change to revision, selection, or run history. */
  subscribe(cb: () => void): () => void;
}

/* ---------------------------------------------------------------- the controls */

export interface ProposalView {
  id: string;
  baseRevision: number;
  title: string;
  rationale: string;
  changes: PatchChange[];
  expectedTradeoffs: string[];
  status: 'draft' | 'applied' | 'rejected';
}

/**
 * The human half of the approval boundary.
 *
 * NOTHING under `src/webmcp/` may import this — a test enforces it. It is the
 * only surface that mutates the architecture graph, and keeping it out of the
 * tool layer's reach by construction is what makes "the agent cannot change
 * anything" a structural fact rather than a promise.
 */
export interface ArchLabControls {
  setSelection(componentIds: string[]): void;
  clearSelection(): void;
  listProposals(): readonly ProposalView[];
  /** The ONLY path that mutates the graph and increments the revision. */
  applyProposal(id: string): boolean;
  rejectProposal(id: string): boolean;
  /**
   * Restores the seed graph, clears proposals and selection, and resets the
   * revision. Human-only, like everything else here. The demo needs it to
   * record a second take, and tests need it because applying a proposal now
   * genuinely mutates the graph.
   */
  resetToSeed(): void;
  componentIds(): string[];
  /** True while running on fixture data rather than the real domain layer. */
  isFixture: boolean;
}
