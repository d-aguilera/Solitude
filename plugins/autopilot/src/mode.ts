import type { ExternalControlInput } from "@solitude/plugin-api/input";

export type AutopilotMode =
  "none" | "alignToVelocity" | "alignToBody" | "orbit" | "circleNow";

export function getAutopilotMode(
  controlInput: ExternalControlInput,
): AutopilotMode {
  if (controlInput.circleNow) return "circleNow";
  if (controlInput.orbit) return "orbit";
  if (controlInput.alignToBody) return "alignToBody";
  if (controlInput.alignToVelocity) return "alignToVelocity";
  return "none";
}
