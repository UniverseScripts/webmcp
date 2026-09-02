/**
 * The single swap point between the WebMCP tool layer and the domain layer.
 *
 * When the domain lane lands a real graph + simulator, point the three bindings
 * below at it and delete `src/contracts/fixture/`. Nothing in `src/webmcp/`
 * changes. Implement `ArchLabPort` and `ArchLabControls` from `./port` — those
 * two interfaces are the entire contract.
 *
 * `controls` is exported here for the UI only. Nothing under `src/webmcp/` may
 * import it, and a test enforces that: it is the sole surface that can mutate
 * the architecture graph, so keeping it out of the tool layer's reach by
 * construction is what makes "the agent cannot change anything" structural
 * rather than a promise.
 */

import { fixtureControls, fixturePort, lastRun as fixtureLastRun } from './fixture';

export * from './port';

export const port = fixturePort;
export const controls = fixtureControls;
export const lastRun = fixtureLastRun;

/**
 * True while the app is running on hard-coded fixture data. Surfaced in the UI
 * and the README so no one -- judge or teammate -- mistakes directional fixture
 * numbers for a real simulation.
 */
export const IS_FIXTURE = true;
