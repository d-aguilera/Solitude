import type {
  AdventureCue,
  AdventureObjective,
  AdventureSample,
} from "@solitude/plugin-api/my-first-orbit";
import type { StandalonePhase } from "@solitude/plugin-api/standalone-session";
import {
  adventureEarthId,
  adventureEntityId,
  maximumSafeApoapsisAltitudeMeters,
  minimumSafePeriapsisAltitudeMeters,
} from "./definition";

const alignedEnter = Math.cos((8 * Math.PI) / 180);
const alignedExit = Math.cos((10 * Math.PI) / 180);
const finite = (value: number | null) =>
  value !== null && Number.isFinite(value);

/** One retained director per run. Only completed samples advance its clocks. */
export function createGuidanceDirector(
  generation: number,
  objective: AdventureObjective,
  orbitLineEnabled: () => boolean,
) {
  const state = {
    cue: null as AdventureCue | null,
    visible: false,
    aligned: true,
    warning: null as "intersection" | "belowTarget" | null,
    acknowledgment: null as
      "safeEntered" | "resetBurn" | "resetUnsafe" | "resetUnknown" | null,
    hint: null as
      | "hintStall"
      | "hintRecover"
      | "hintOrbit"
      | "hintOrientOrbit"
      | "hintAlign"
      | "hintCoast"
      | "hintCorrection"
      | "hintUnavailable"
      | null,
    hintsEnabled: false,
  };
  let periapsis: number | null = null;
  let phase: StandalonePhase = "briefing";
  let blocked = false;
  let sequence = 0;
  let lastNow: number | null = null;
  let lastSim: number | null = null;
  let activeMillis = 0;
  let aligned = true;
  let orbitLineSeen = false;
  let orbitAttitudeSeen = false;
  let previousSafe = false;
  let resetCounter = 0;
  let cue: AdventureCue | null = null;
  let acknowledgment:
    "safeEntered" | "resetBurn" | "resetUnsafe" | "resetUnknown" | null = null;
  let acknowledgmentUntil = 0;
  let lastSafeAck = -Infinity;
  let lastResetAck = -Infinity;
  let stallBaseline: number | null = null;
  let stallSince = 0;
  let lastStall = -Infinity;
  let stallUntil = 0;
  const clearStall = () => {
    stallBaseline = null;
    stallUntil = 0;
    stallSince = activeMillis;
  };
  const clearTransient = () => {
    clearStall();
    acknowledgment = null;
    state.acknowledgment = null;
    previousSafe = objective.safeOrbit;
    resetCounter = objective.confirmationReset;
  };
  const updateHint = () => {
    let hint: typeof state.hint = null;
    if (state.hintsEnabled && cue !== null) {
      if (cue === "recover")
        hint = stallUntil > activeMillis ? "hintStall" : "hintRecover";
      else if (cue === "showOrbit") hint = "hintOrbit";
      else if (cue === "orientOrbit") hint = "hintOrientOrbit";
      else if (cue === "align") hint = "hintAlign";
      else if (cue === "release" || cue === "coast") hint = "hintCoast";
      else if (cue === "escape" || cue === "highApoapsis")
        hint = "hintCorrection";
      else hint = "hintUnavailable";
    }
    state.hint = hint;
  };
  const select = (next: AdventureCue) => {
    if (cue !== next) {
      cue = next;

      clearStall();
    }
    state.cue = next;
  };
  return {
    state,
    setHintsEnabled: (requestedGeneration: number, enabled: boolean) => {
      if (
        requestedGeneration !== generation ||
        blocked ||
        phase === "completed" ||
        phase === "failed" ||
        state.hintsEnabled === enabled
      )
        return;
      state.hintsEnabled = enabled;
      clearStall();
      if (enabled && cue === "recover" && periapsis !== null)
        stallBaseline = periapsis;
      updateHint();
    },
    sample: (sample: AdventureSample) => {
      if (blocked || phase !== "flying") return;
      if (sample.generation !== generation || sample.sequence <= sequence)
        return;
      sequence = sample.sequence;
      if (
        sample.entityId !== adventureEntityId ||
        !Number.isFinite(sample.nowMs) ||
        !Number.isFinite(sample.simTimeMillis) ||
        (lastNow !== null &&
          (sample.nowMs <= lastNow || sample.nowMs - lastNow > 250)) ||
        (lastSim !== null && sample.simTimeMillis <= lastSim)
      ) {
        lastNow = null;
        lastSim = null;
        clearTransient();
        periapsis = null;
        state.aligned = false;
        select("unavailable");
        state.warning = null;
        state.visible = true;
        updateHint();
        return "unavailable" as const;
      }
      if (lastNow !== null) activeMillis += sample.nowMs - lastNow;
      lastNow = sample.nowMs;
      lastSim = sample.simTimeMillis;
      if (
        sample.progradeAlignmentCosine !== null &&
        Number.isFinite(sample.progradeAlignmentCosine) &&
        Math.abs(sample.progradeAlignmentCosine) <= 1
      )
        aligned =
          sample.progradeAlignmentCosine >=
          (aligned ? alignedExit : alignedEnter);
      else aligned = false;
      state.aligned = aligned;
      periapsis = sample.periapsisAltitudeMeters;
      let next: AdventureCue;
      if (orbitLineEnabled()) orbitLineSeen = true;
      if (
        orbitLineSeen &&
        sample.progradeAlignmentCosine !== null &&
        Number.isFinite(sample.progradeAlignmentCosine) &&
        sample.progradeAlignmentCosine >= alignedEnter &&
        sample.earthUpAlignmentCosine !== null &&
        Number.isFinite(sample.earthUpAlignmentCosine) &&
        sample.earthUpAlignmentCosine >= alignedEnter
      )
        orbitAttitudeSeen = true;
      if (
        !finite(sample.earthAltitudeMeters) ||
        !sample.orbitValid ||
        !finite(sample.periapsisAltitudeMeters) ||
        (sample.isBound && !finite(sample.apoapsisAltitudeMeters)) ||
        sample.propulsionActive === null
      )
        next = "unavailable";
      else if (sample.primaryId !== adventureEarthId) next = "primaryChanged";
      else if (!sample.isBound) next = "escape";
      else if (
        sample.apoapsisAltitudeMeters! > maximumSafeApoapsisAltitudeMeters
      )
        next = "highApoapsis";
      else if (objective.safeOrbit && sample.propulsionActive) next = "release";
      else if (objective.status === "confirming") next = "coast";
      else if (!orbitLineSeen) next = "showOrbit";
      else if (!orbitAttitudeSeen) next = "orientOrbit";
      else if (
        sample.periapsisAltitudeMeters! < minimumSafePeriapsisAltitudeMeters
      )
        next = aligned ? "recover" : "align";
      else next = "unavailable";
      select(next);
      state.visible = true;
      state.warning =
        next === "showOrbit" ||
        next === "orientOrbit" ||
        next === "recover" ||
        next === "align"
          ? sample.periapsisAltitudeMeters! < 0
            ? "intersection"
            : "belowTarget"
          : null;
      // Consume transitions even when higher-priority feedback suppresses them.
      const reset = objective.confirmationReset !== resetCounter;
      const entered = objective.safeOrbit && !previousSafe;
      resetCounter = objective.confirmationReset;
      previousSafe = objective.safeOrbit;
      if (
        acknowledgment &&
        (activeMillis >= acknowledgmentUntil ||
          (acknowledgment === "safeEntered"
            ? !objective.safeOrbit
            : objective.status === "confirming") ||
          next === "unavailable" ||
          next === "primaryChanged" ||
          next === "escape" ||
          next === "highApoapsis")
      )
        acknowledgment = null;
      if (
        reset &&
        (next === "release" || next === "recover" || next === "align") &&
        activeMillis - lastResetAck >= 8000
      ) {
        acknowledgment =
          sample.propulsionActive === true
            ? "resetBurn"
            : !objective.safeOrbit
              ? "resetUnsafe"
              : "resetUnknown";
        lastResetAck = activeMillis;
        acknowledgmentUntil = activeMillis + 3000;
      } else if (
        entered &&
        (next === "release" || next === "coast") &&
        activeMillis - lastSafeAck >= 8000
      ) {
        acknowledgment = "safeEntered";
        lastSafeAck = activeMillis;
        acknowledgmentUntil = activeMillis + 3000;
      }
      state.acknowledgment = acknowledgment;
      if (next === "recover" && state.hintsEnabled) {
        const periapsis = sample.periapsisAltitudeMeters!;
        if (stallBaseline === null || periapsis - stallBaseline >= 1000) {
          stallBaseline = periapsis;
          stallSince = activeMillis;
          stallUntil = 0;
        } else if (
          activeMillis - stallSince >= 8000 &&
          activeMillis - lastStall >= 20000
        ) {
          lastStall = activeMillis;
          stallUntil = activeMillis + 5000;
        }
      }
      updateHint();
      return "sample" as const;
    },
    setPhase: (next: StandalonePhase, replacementPending = false) => {
      phase = next;
      blocked = replacementPending;
      lastNow = null;
      lastSim = null;
      // Paused acknowledgments/cooldowns freeze; suspension clears transient advice.
      if (
        next === "suspended" ||
        next === "completed" ||
        next === "failed" ||
        blocked
      ) {
        clearTransient();
        updateHint();
      }
      previousSafe = objective.safeOrbit;
      resetCounter = objective.confirmationReset;
      state.visible = false;
    },
  };
}
