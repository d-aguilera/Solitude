import type {
  StandaloneCommand,
  StandaloneMode,
  StandalonePhase,
  StandaloneSession,
} from "@solitude/plugin-api/standalone-session";
import type { createSessionClock } from "./clock";
import type { createSessionPresentation } from "./presentation";

/** Lifecycle transitions coordinate explicit rule effects and frame policy. */
export function createSessionLifecycle(
  generation: number,
  mode: StandaloneMode,
  canFly: () => boolean,
  clock: ReturnType<typeof createSessionClock>,
  presentation: ReturnType<typeof createSessionPresentation>,
  effects: {
    changePhase: (phase: StandalonePhase) => void;
    block: (phase: StandalonePhase) => void;
  },
) {
  let phase: StandalonePhase =
    mode === "my-first-orbit" ? "briefing" : "flying";
  let lifecycleRequest: "retry" | "menu" | null = null;
  let advance = false;
  const listeners = new Set<() => void>();
  let resetInput = () => {};
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const changePhase = (next: StandalonePhase) => {
    phase = next;
    clock.rebase();
    advance = false;
    effects.changePhase(next);
    resetInput();
    notify();
  };
  const session: StandaloneSession = {
    generation,
    mode,
    get advanceSimulation() {
      return advance && !lifecycleRequest && phase === "flying";
    },
    get phase() {
      return phase;
    },
    get lifecycleRequest() {
      return lifecycleRequest;
    },
    labels: presentation.labels,
    command: (command: StandaloneCommand) => {
      if (lifecycleRequest) return;
      if (command === "retry" || command === "menu") {
        lifecycleRequest = command;
        advance = false;
        effects.block(phase);
        resetInput();
        notify();
      } else if (mode === "my-first-orbit") {
        if (
          command === "begin" &&
          phase === "briefing" &&
          clock.ready &&
          canFly()
        )
          changePhase("flying");
        if (command === "pause" && phase === "flying") changePhase("paused");
        if (
          command === "resume" &&
          (phase === "paused" || phase === "suspended") &&
          canFly()
        )
          changePhase("flying");
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attachInputReset: (reset) => {
      resetInput = reset;
      return () => {
        resetInput = () => {};
      };
    },
    getPresentation: () =>
      presentation.project(mode, phase, clock.ready, canFly()),
  };
  return {
    changePhase,
    session,
    refresh: notify,
    observeStartupFrame: (now: number, dt: number): void => {
      if (clock.ready || phase !== "briefing" || lifecycleRequest) return;
      if (clock.observeStartupFrame(now, dt, canFly())) notify();
    },
    suspend: () => {
      clock.resetStartup();
      resetInput();
      if (phase === "flying") changePhase("suspended");
      else {
        clock.rebase();
        notify();
      }
    },
    updateFrame: (now: number, dt: number): void => {
      advance = false;
      if (lifecycleRequest || phase !== "flying") return;
      if (!canFly()) {
        changePhase("suspended");
        return;
      }
      const decision = clock.updateFrame(now, dt);
      if (decision === "suspend") changePhase("suspended");
      else advance = decision === "advance";
    },
    canAdvance: () => advance && !lifecycleRequest && phase === "flying",
  };
}
