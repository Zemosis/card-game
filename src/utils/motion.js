// MOTION — the player's animation setting, FULL (the default) or REDUCED.
//
// The OS "reduce motion" preference is deliberately ignored: Windows turns it
// on with "Animation effects" off or "Adjust for best performance", which many
// players never chose, and the table then dealt and moved cards with no motion
// at all. Players who want less motion pick REDUCED in Settings. The choice is
// mirrored on <html data-motion>, so CSS can follow it too.

const KEY = "khuzur_motion";

let reduced = (() => {
  try {
    return localStorage.getItem(KEY) === "reduced";
  } catch {
    return false;
  }
})();

const mirror = () => {
  if (typeof document !== "undefined") document.documentElement.dataset.motion = reduced ? "reduced" : "full";
};
mirror();

/** True when the player picked reduced animations. */
export const reducedMotion = () => reduced;

export function setReducedMotion(on) {
  reduced = !!on;
  mirror();
  try {
    localStorage.setItem(KEY, reduced ? "reduced" : "full");
  } catch {
    /* private window: the choice just won't persist */
  }
}
