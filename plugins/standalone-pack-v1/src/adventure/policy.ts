import type { ExternalControlInput } from "@solitude/plugin-api/input";
export const flightActions = new Set([
  "alignToVelocity",
  "burnForward",
  "burnBackwards",
  "rollLeft",
  "rollRight",
  "pitchUp",
  "pitchDown",
  "yawLeft",
  "yawRight",
]);
export const viewActions = new Set([
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
  "lookReset",
  "orbitSegmentsToggle",
  "targetingLaserToggle",
]);

export function sanitizeAdventureInput(
  input: ExternalControlInput,
  flying: boolean,
): void {
  for (const action in input) {
    if (!viewActions.has(action) && !(flying && flightActions.has(action)))
      input[action] = false;
  }
}
