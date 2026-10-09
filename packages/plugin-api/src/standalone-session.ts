import type { ExternalRuntimeOptions } from "./runtime";

export const standaloneSessionCapability = "solitude.standaloneSession.v1";
export const standaloneModeOption = "solitudeStandaloneMode";
export const standaloneGenerationOption = "solitudeStandaloneGeneration";
export type StandaloneMode = "my-first-orbit" | "free-flight";
export type StandalonePhase = "briefing" | "flying" | "paused" | "suspended";
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
