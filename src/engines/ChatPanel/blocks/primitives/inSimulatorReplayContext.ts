/**
 * InSimulatorReplayContext
 *
 * Signals that the current block subtree is being rendered inside the
 * Simulator's SessionReplay surface (e.g. WorkStation → Messages tab).
 *
 * Primitives read this to suppress affordances that only make sense
 * when the user is *outside* the Simulator — most notably the
 * `EventBlockHeader` navigate-arrow whose action is "jump to this
 * event in the Simulator". When already inside the Simulator the
 * jump points to the current location, so the icon is hidden.
 *
 * Default `false` (regular ChatPanel history).
 */
import { createContext } from "react";

export const InSimulatorReplayContext = createContext<boolean>(false);

export default InSimulatorReplayContext;
