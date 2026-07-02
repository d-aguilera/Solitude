import type { ControlInput } from "@solitude/engine/plugin";

export type AutopilotMode =
  | "none"
  | "alignToVelocity"
  | "alignToBody"
  | "orbit"
  | "circleNow";

export function getAutopilotMode(controlInput: ControlInput): AutopilotMode {
  if (controlInput.circleNow) return "circleNow";
  if (controlInput.orbit) return "orbit";
  if (controlInput.alignToBody) return "alignToBody";
  if (controlInput.alignToVelocity) return "alignToVelocity";
  return "none";
}
