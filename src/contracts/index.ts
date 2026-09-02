/**
 * The single swap point between the WebMCP tool layer and the domain layer.
 *
 * When the domain lane lands a real graph + simulator, change the two imports
 * below and delete `src/contracts/fixture/`. Nothing in `src/webmcp/` changes.
 */

import { fixtureControls, fixturePort } from './fixture';

export * from './port';

export const port = fixturePort;
export const controls = fixtureControls;

/**
 * True while the app is running on hard-coded fixture data. Surfaced in the UI
 * and the README so no one -- judge or teammate -- mistakes directional
 * fixture numbers for a real simulation.
 */
export const IS_FIXTURE = true;
