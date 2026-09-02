/**
 * Signpost, not an implementation.
 *
 * The planning docs tell the domain/simulation lane to implement `src/state/api.ts`
 * exporting `getSnapshot()`, `subscribe()` and `dispatch()`. That shape changed
 * during implementation, so this file exists to stop anyone searching for the old
 * one, finding nothing, and losing an hour to it.
 *
 * WHAT TO IMPLEMENT: `ArchLabPort` and `ArchLabControls` in `src/contracts/port.ts`.
 * Wire it into `src/contracts/index.ts` -- three bindings -- and delete
 * `src/contracts/fixture/`. Nothing under `src/webmcp/` needs to change.
 *
 * WHY IT CHANGED, since this was not a unilateral tidy-up:
 *   - `getSnapshot(): AppSnapshot` invites a tool that returns the whole state
 *     blob. That is the exact anti-pattern the plan forbids, and the surest way
 *     to blow Chrome's 1.5K per-tool output budget.
 *   - `dispatch(action)` is a general write channel. Handing one to the tool layer
 *     would make "the agent cannot change anything" unprovable. Mutation lives on
 *     `ArchLabControls` instead, which the tool layer may not import -- enforced
 *     by a test, not by convention.
 *
 * The port is wider than three functions because every method is narrow and
 * read-only by design. That is the trade: more surface, no write path.
 */

export type { ArchLabControls, ArchLabPort } from '../contracts/port';
export { controls, port } from '../contracts';
