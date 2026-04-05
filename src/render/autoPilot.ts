import type { AutopilotMode } from "../app/autoPilot.js";
import type { CircleNowHudDebug } from "./renderPorts.js";

export function formatAutopilotStatus(mode: AutopilotMode): string {
  const vel = mode === "alignToVelocity" ? "[VEL]" : "VEL";
  const body = mode === "alignToBody" ? "[BODY]" : "BODY";
  const circle = mode === "circleNow" ? "[CN]" : "CN";
  return "AP: ".concat(vel, " ", body, " ", circle);
}

export function formatCircleNowWarnings(
  circleNowDebug: CircleNowHudDebug | null | undefined,
): string {
  if (!circleNowDebug?.active) return "";

  const warnings: string[] = [];
  if (circleNowDebug.tangentialSource === "none") {
    warnings.push("NO TAN");
  } else {
    if (circleNowDebug.tangentialSpeed < 1) {
      warnings.push("TAN LOW");
    }
    if (circleNowDebug.tangentialSource === "fallback") {
      warnings.push("FALLBACK");
    }
  }
  if (
    circleNowDebug.tangentialDirDot != null &&
    circleNowDebug.tangentialDirDot < -0.2
  ) {
    warnings.push("TAN FLIP");
  } else if (
    circleNowDebug.tangentialDirDeltaDeg != null &&
    circleNowDebug.tangentialDirDeltaDeg > 45
  ) {
    warnings.push("TAN SWING");
  }
  if (
    circleNowDebug.tangentialDirRateDegPerSec != null &&
    circleNowDebug.tangentialDirRateDegPerSec > 20
  ) {
    warnings.push(
      "TAN RATE ".concat(
        circleNowDebug.tangentialDirRateDegPerSec.toFixed(0),
        "°/s",
      ),
    );
  }

  return warnings.length ? "!! CN WARN: ".concat(warnings.join(" | ")) : "";
}
