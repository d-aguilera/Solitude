import type { ExternalRuntimeOptions } from "./runtime";
import type { ExternalOrbitObservation } from "./telemetry";

export const standaloneSessionCapability = "solitude.standaloneSession.v1";
export const standaloneModeOption = "solitudeStandaloneMode";
export const standaloneGenerationOption = "solitudeStandaloneGeneration";
export type StandaloneMode = "my-first-orbit" | "free-flight";
export type StandalonePhase =
  "briefing" | "flying" | "paused" | "suspended" | "completed" | "failed";
export type StandaloneCommand = "begin" | "pause" | "resume" | "retry" | "menu";
export interface StandalonePresentation {
  title: string;
  body: string;
  actions: readonly {
    command: StandaloneCommand;
    label: string;
    disabled: boolean;
  }[];
}
export interface StandaloneSession {
  readonly generation: number;
  readonly mode: StandaloneMode;
  readonly phase: StandalonePhase;
  readonly advanceSimulation: boolean;
  readonly lifecycleRequest: "retry" | "menu" | null;
  readonly labels: {
    title: string;
    adventure: string;
    freeFlight: string;
    selectionError: string;
    startupError: string;
    menu: string;
    pause: string;
  };
  getPresentation: () => StandalonePresentation | null;
  command: (command: StandaloneCommand) => void;
  subscribe: (listener: () => void) => () => void;
  attachInputReset: (reset: () => void) => () => void;
}
export function isAdventure(options: ExternalRuntimeOptions): boolean {
  return options[standaloneModeOption] === "my-first-orbit";
}
export function isStandaloneSession(
  value: unknown,
): value is StandaloneSession {
  const candidate = value as Partial<StandaloneSession> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.generation === "number" &&
    typeof candidate.command === "function" &&
    typeof candidate.getPresentation === "function" &&
    typeof candidate.subscribe === "function" &&
    typeof candidate.attachInputReset === "function" &&
    typeof candidate.labels === "object"
  );
}

export const adventureObjectiveCapability = "solitude.adventureObjective.v1";
export interface AdventureSample extends ExternalOrbitObservation {
  generation: number;
  sequence: number;
  simTimeMillis: number;
  nowMs: number;
  earthAltitudeMeters: number | null;
  earthUpAlignmentCosine: number | null;
  propulsionActive: boolean | null;
}
export interface AdventureObjective {
  readonly status: "recovering" | "confirming" | "completed" | "failed";
  readonly coastMillis: number;
  readonly latestSequence: number;
  readonly terminalSequence: number | null;
  readonly safeOrbit: boolean;
  /** Retained record, replaced in place on each completed advancing frame. */
  readonly latestSample: Readonly<AdventureSample> | null;
  readonly safeOrbitEntered: number;
  readonly confirmationStarted: number;
  readonly confirmationReset: number;
  readonly safeOrbitConfirmed: number;
  sample: (sample: AdventureSample) => void;
}
export function isAdventureObjective(
  value: unknown,
): value is AdventureObjective {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AdventureObjective).sample === "function"
  );
}

export const adventureGuidanceCapability = "solitude.adventureGuidance.v1";
export type AdventureCue =
  | "showOrbit"
  | "orientOrbit"
  | "unavailable"
  | "primaryChanged"
  | "escape"
  | "highApoapsis"
  | "release"
  | "coast"
  | "align"
  | "recover";
export type AdventureInstrumentId =
  | "adventure.orbit.primary"
  | "adventure.orbit.periapsisAltitude"
  | "adventure.orbit.apoapsisAltitude"
  | "adventure.earth.altitude"
  | "adventure.flight.progradeAlignment"
  | "adventure.flight.propulsion"
  | "adventure.objective.coast";
export interface AdventureInstrument {
  readonly id: AdventureInstrumentId;
  readonly label: string;
  /** Unrounded SI value, entity ID, alignment state, or applied-propulsion flag. */
  readonly value: number | string | boolean | null;
  readonly unit: "m" | "ms" | null;
  readonly text: string;
  readonly emphasized: boolean;
}
/** Retained read-only presentation; reads never advance guidance or objectives. */
export interface AdventureGuidance {
  readonly generation: number;
  readonly revision: number;
  readonly visible: boolean;
  readonly cue: AdventureCue | null;
  readonly cueText: string;
  readonly warningText: string;
  readonly acknowledgmentText: string;
  readonly objectiveText: string;
  readonly hintText: string;
  readonly hintsEnabled: boolean;
  readonly hintToggleLabel: string;
  readonly instruments: readonly AdventureInstrument[];
  setHintsEnabled: (generation: number, enabled: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}
/** Producer seam used only after objective evaluation in the final frame policy. */
export interface AdventureGuidanceProvider {
  readonly guidance: AdventureGuidance;
  sample: (sample: AdventureSample, primaryDisplayName: string) => void;
}
export function isAdventureGuidanceProvider(
  value: unknown,
): value is AdventureGuidanceProvider {
  const candidate = value as Partial<AdventureGuidanceProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.sample === "function" &&
    typeof candidate.guidance === "object" &&
    candidate.guidance !== null &&
    typeof candidate.guidance.subscribe === "function" &&
    typeof candidate.guidance.setHintsEnabled === "function"
  );
}
