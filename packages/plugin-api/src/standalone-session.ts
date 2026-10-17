/** Reusable run lifecycle; content identity and gameplay records live elsewhere. */
export const standaloneSessionCapability = "solitude.standaloneSession.v1";
export const standaloneGenerationOption = "solitudeStandaloneGeneration";
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
  readonly mode: string;
  readonly phase: StandalonePhase;
  readonly advanceSimulation: boolean;
  readonly lifecycleRequest: "retry" | "menu" | null;
  getPresentation: () => StandalonePresentation | null;
  command: (command: StandaloneCommand) => void;
  subscribe: (listener: () => void) => () => void;
  attachInputReset: (reset: () => void) => () => void;
}
export function isStandaloneSession(
  value: unknown,
): value is StandaloneSession {
  const candidate = value as Partial<StandaloneSession> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.generation === "number" &&
    typeof candidate.mode === "string" &&
    typeof candidate.command === "function" &&
    typeof candidate.getPresentation === "function" &&
    typeof candidate.subscribe === "function" &&
    typeof candidate.attachInputReset === "function"
  );
}
