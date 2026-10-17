import type {
  AdventureObjective,
  AdventureSample,
} from "@solitude/plugin-api/my-first-orbit";
import {
  adventureEarthId,
  adventureEntityId,
  coastConfirmationMillis,
  failureAltitudeMeters,
  maximumSafeApoapsisAltitudeMeters,
  minimumSafePeriapsisAltitudeMeters,
} from "./definition";

/** A retained hold rule: rendering and commands never credit time. */
export function createObjective(
  generation: number,
  terminal: (phase: "completed" | "failed") => void,
  active: () => boolean,
) {
  let status: AdventureObjective["status"] = "recovering";
  let coastMillis = 0;
  let latestSequence = 0;
  let latestSample: Readonly<AdventureSample> | null = null;
  let terminalSequence: number | null = null;
  let lastEligibleNow: number | null = null;
  let lastSampleNow: number | null = null;
  let lastSimTime: number | null = null;
  let safeOrbit = false;
  let safeOrbitEntered = 0;
  let confirmationStarted = 0;
  let confirmationReset = 0;
  let safeOrbitConfirmed = 0;
  const reset = () => {
    if (status === "completed" || status === "failed") return;
    if (status === "confirming") confirmationReset++;
    coastMillis = 0;
    lastEligibleNow = null;
    safeOrbit = false;
    status = "recovering";
  };
  const objective: AdventureObjective = {
    get status() {
      return status;
    },
    get coastMillis() {
      return coastMillis;
    },
    get latestSample() {
      return latestSample;
    },
    get latestSequence() {
      return latestSequence;
    },
    get terminalSequence() {
      return terminalSequence;
    },
    get safeOrbit() {
      return safeOrbit;
    },
    get safeOrbitEntered() {
      return safeOrbitEntered;
    },
    get confirmationStarted() {
      return confirmationStarted;
    },
    get confirmationReset() {
      return confirmationReset;
    },
    get safeOrbitConfirmed() {
      return safeOrbitConfirmed;
    },
    sample: (sample: AdventureSample) => {
      if (!active() || status === "completed" || status === "failed") return;
      // A retired generation cannot replace current sample history or cause failure.
      if (sample.generation !== generation) {
        reset();
        return;
      }
      if (sample.sequence <= latestSequence) return;
      latestSequence = sample.sequence;
      latestSample = sample;
      if (sample.entityId !== adventureEntityId) {
        reset();
        return;
      }
      // Explicit Earth distance stays authoritative even with invalid orbital data.
      if (
        sample.earthAltitudeMeters !== null &&
        Number.isFinite(sample.earthAltitudeMeters) &&
        sample.earthAltitudeMeters <= failureAltitudeMeters
      ) {
        status = "failed";
        terminalSequence = sample.sequence;
        lastEligibleNow = null;
        terminal("failed");
        return;
      }
      const clockValid =
        Number.isFinite(sample.nowMs) &&
        Number.isFinite(sample.simTimeMillis) &&
        (lastSampleNow === null || sample.nowMs > lastSampleNow) &&
        (lastSimTime === null || sample.simTimeMillis > lastSimTime);
      lastSampleNow = Number.isFinite(sample.nowMs) ? sample.nowMs : null;
      lastSimTime = Number.isFinite(sample.simTimeMillis)
        ? sample.simTimeMillis
        : null;
      const safe =
        sample.orbitValid &&
        sample.primaryId === adventureEarthId &&
        sample.isBound &&
        sample.periapsisAltitudeMeters !== null &&
        Number.isFinite(sample.periapsisAltitudeMeters) &&
        sample.periapsisAltitudeMeters >= minimumSafePeriapsisAltitudeMeters &&
        sample.apoapsisAltitudeMeters !== null &&
        Number.isFinite(sample.apoapsisAltitudeMeters) &&
        sample.apoapsisAltitudeMeters <= maximumSafeApoapsisAltitudeMeters;
      if (
        !clockValid ||
        !safe ||
        sample.propulsionActive !== false ||
        (lastEligibleNow !== null && sample.nowMs - lastEligibleNow > 250)
      ) {
        const wasSafe = safeOrbit;
        reset();
        if (safe && clockValid) {
          if (!wasSafe) safeOrbitEntered++;
          safeOrbit = true;
        }
        return;
      }
      if (!safeOrbit) safeOrbitEntered++;
      safeOrbit = true;
      if (status !== "confirming") {
        status = "confirming";
        confirmationStarted++;
      }
      if (lastEligibleNow !== null)
        coastMillis += sample.nowMs - lastEligibleNow;
      lastEligibleNow = sample.nowMs;
      if (coastMillis >= coastConfirmationMillis) {
        status = "completed";
        terminalSequence = sample.sequence;
        safeOrbitConfirmed++;
        terminal("completed");
      }
    },
  };
  return {
    objective,
    reset,
    pause: () => {
      lastEligibleNow = null;
      lastSampleNow = null;
      lastSimTime = null;
    },
  };
}
