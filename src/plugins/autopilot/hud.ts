import type { HudPlugin } from "../../app/pluginPorts.js";
import type { ShipBody, World } from "../../domain/domainPorts.js";
import { EPS_LEN_COARSE, EPS_SPEED_COARSE } from "../../domain/epsilon.js";
import { getDominantBodyPrimary } from "../../domain/orbit.js";
import { vec3 } from "../../domain/vec3.js";
import { getAutopilotMode } from "./logic.js";

export function createHudPlugin(): HudPlugin {
  const circleNowTracker = createCircleNowDebugTracker();

  return {
    updateHudParams: (params, { controlInput, mainShip, nowMs, world }) => {
      circleNowTracker.update(world, mainShip, controlInput.circleNow, nowMs);
      const autopilotMode = getAutopilotMode(controlInput);
      params.hudCells.push({
        row: 0,
        col: 3,
        text: formatAutopilotStatus(autopilotMode),
      });

      const warning = formatCircleNowWarnings(circleNowTracker.debug);
      if (warning) {
        params.hudCells.push({ row: 4, col: 2, text: warning });
      }
    },
  };
}

interface CircleNowDebugTracker {
  debug: CircleNowHudDebug;
  update: (
    world: World,
    ship: ShipBody,
    circleNowActive: boolean,
    nowMs: number,
  ) => void;
}

function createCircleNowDebugTracker(): CircleNowDebugTracker {
  const prevTangentialDir = vec3.zero();
  const debugRScratch = vec3.zero();
  const debugRHatScratch = vec3.zero();
  const debugVRelScratch = vec3.zero();
  const debugTScratch = vec3.zero();
  let prevTangentialValid = false;
  let prevTangentialTimeMs = 0;
  let lastCircleNowActive = false;

  const debug: CircleNowHudDebug = {
    active: false,
    radialSpeed: 0,
    tangentialSpeed: 0,
    tangentialSource: "none",
    tangentialDirDot: null,
    tangentialDirDeltaDeg: null,
    tangentialDirRateDegPerSec: null,
  };

  const update = (
    world: World,
    ship: ShipBody,
    circleNowActive: boolean,
    nowMs: number,
  ): void => {
    debug.active = circleNowActive;
    if (!circleNowActive) {
      debug.tangentialSource = "none";
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
      debug.radialSpeed = 0;
      debug.tangentialSpeed = 0;
      prevTangentialValid = false;
      lastCircleNowActive = false;
      prevTangentialTimeMs = 0;
      return;
    }

    if (!lastCircleNowActive) {
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
    }
    lastCircleNowActive = true;

    const primary = getDominantBodyPrimary(world, ship.position);
    if (!primary) {
      debug.tangentialSource = "none";
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
      debug.radialSpeed = 0;
      debug.tangentialSpeed = 0;
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
      return;
    }

    vec3.subInto(debugRScratch, ship.position, primary.body.position);
    const rLen = vec3.length(debugRScratch);
    if (rLen === 0) {
      debug.tangentialSource = "none";
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
      debug.radialSpeed = 0;
      debug.tangentialSpeed = 0;
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
      return;
    }

    vec3.scaleInto(debugRHatScratch, 1 / rLen, debugRScratch);
    vec3.subInto(debugVRelScratch, ship.velocity, primary.body.velocity);
    const radialSpeed = vec3.dot(debugRHatScratch, debugVRelScratch);
    debug.radialSpeed = radialSpeed;

    vec3.scaleInto(debugTScratch, radialSpeed, debugRHatScratch);
    vec3.subInto(debugTScratch, debugVRelScratch, debugTScratch);
    const tangentialSpeed = vec3.length(debugTScratch);
    debug.tangentialSpeed = tangentialSpeed;

    let directionValid = false;
    if (tangentialSpeed > EPS_SPEED_COARSE) {
      vec3.scaleInto(debugTScratch, 1 / tangentialSpeed, debugTScratch);
      debug.tangentialSource = "velocity";
      directionValid = true;
    } else {
      vec3.copyInto(debugTScratch, ship.frame.right);
      const proj = vec3.dot(debugTScratch, debugRHatScratch);
      debugTScratch.x -= proj * debugRHatScratch.x;
      debugTScratch.y -= proj * debugRHatScratch.y;
      debugTScratch.z -= proj * debugRHatScratch.z;
      const projLen = vec3.length(debugTScratch);
      if (projLen > EPS_LEN_COARSE) {
        vec3.scaleInto(debugTScratch, 1 / projLen, debugTScratch);
        debug.tangentialSource = "fallback";
        directionValid = true;
      } else {
        debug.tangentialSource = "none";
      }
    }

    if (directionValid && prevTangentialValid) {
      const dot = vec3.dot(prevTangentialDir, debugTScratch);
      const clampedDot = Math.min(1, Math.max(-1, dot));
      debug.tangentialDirDot = clampedDot;
      const deltaDeg = (Math.acos(clampedDot) * 180) / Math.PI;
      debug.tangentialDirDeltaDeg = deltaDeg;
      const dtSec = (nowMs - prevTangentialTimeMs) / 1000;
      debug.tangentialDirRateDegPerSec = dtSec > 0 ? deltaDeg / dtSec : null;
    } else {
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
    }

    if (directionValid) {
      vec3.copyInto(prevTangentialDir, debugTScratch);
      prevTangentialValid = true;
      prevTangentialTimeMs = nowMs;
    } else {
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
    }
  };

  return { debug, update };
}

type CircleNowHudDebugSource = "velocity" | "fallback" | "none";

interface CircleNowHudDebug {
  active: boolean;
  radialSpeed: number;
  tangentialSpeed: number;
  tangentialSource: CircleNowHudDebugSource;
  tangentialDirDot: number | null;
  tangentialDirDeltaDeg: number | null;
  tangentialDirRateDegPerSec: number | null;
}

function formatAutopilotStatus(
  mode: ReturnType<typeof getAutopilotMode>,
): string {
  const vel = mode === "alignToVelocity" ? "[VEL]" : "VEL";
  const body = mode === "alignToBody" ? "[BODY]" : "BODY";
  const circle = mode === "circleNow" ? "[CN]" : "CN";
  return "AP: ".concat(vel, " ", body, " ", circle);
}

function formatCircleNowWarnings(
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
