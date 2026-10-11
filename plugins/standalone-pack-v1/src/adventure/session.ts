import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type {
  StandaloneCommand,
  StandaloneMode,
  StandalonePhase,
  StandalonePresentation,
  StandaloneSession,
} from "@solitude/plugin-api/standalone-session";
import { createGuidance } from "./guidance";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import { createObjective } from "./objective";

export function createSession(
  generation: number,
  mode: StandaloneMode,
  locale: ExternalLocale,
  canFly: () => boolean,
) {
  const messages = { en, es, fr }[locale];
  let phase: StandalonePhase =
    mode === "my-first-orbit" ? "briefing" : "flying";
  let lifecycleRequest: "retry" | "menu" | null = null;
  let baseline = true;
  let lastNow: number | null = null;
  let advance = false;
  const hold = createObjective(
    generation,
    (result) => changePhase(result),
    () => advance && !lifecycleRequest && phase === "flying",
  );
  const director = createGuidance(generation, locale, hold.objective);
  const listeners = new Set<() => void>();
  let resetInput = () => {};
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const changePhase = (next: StandalonePhase) => {
    if (next === "suspended") hold.reset();
    hold.pause();
    phase = next;
    baseline = true;
    lastNow = null;
    advance = false;
    director.setPhase(next);
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
    labels: messages,
    command: (command: StandaloneCommand) => {
      if (lifecycleRequest) return;
      if (command === "retry" || command === "menu") {
        lifecycleRequest = command;
        advance = false;
        director.setPhase(phase, true);
        resetInput();
        notify();
      } else if (mode === "my-first-orbit") {
        if (command === "begin" && phase === "briefing" && canFly())
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
    getPresentation: (): StandalonePresentation | null => {
      if (mode === "free-flight" || phase === "flying") return null;
      const actions: {
        command: StandaloneCommand;
        label: string;
        disabled: boolean;
      }[] = [];
      if (phase === "briefing")
        actions.push({
          command: "begin",
          label: messages.begin,
          disabled: !canFly(),
        });
      else {
        if (phase === "paused" || phase === "suspended")
          actions.push({
            command: "resume",
            label: messages.resume,
            disabled: !canFly(),
          });
        actions.push({
          command: "retry",
          label: messages.retry,
          disabled: false,
        });
      }
      actions.push({ command: "menu", label: messages.menu, disabled: false });
      return {
        title:
          phase === "briefing"
            ? messages.adventure
            : phase === "paused"
              ? messages.paused
              : phase === "completed"
                ? messages.completed
                : phase === "failed"
                  ? messages.failed
                  : messages.suspended,
        body:
          phase === "briefing"
            ? messages.briefing
            : phase === "suspended"
              ? messages.suspensionBody
              : phase === "completed"
                ? messages.completedBody
                : phase === "failed"
                  ? messages.failedBody
                  : "",
        actions,
      };
    },
  };
  return {
    session,
    objective: hold.objective,
    guidance: director.provider,
    refresh: notify,
    suspend: () => {
      resetInput();
      if (phase === "flying") changePhase("suspended");
      else {
        baseline = true;
        lastNow = null;
        notify();
      }
    },
    updateFrame: (now: number, dt: number): void => {
      advance = false;
      if (lifecycleRequest || phase !== "flying") return;
      if (
        !canFly() ||
        !Number.isFinite(now) ||
        !Number.isFinite(dt) ||
        dt < 0 ||
        (lastNow !== null && now < lastNow)
      ) {
        changePhase("suspended");
        return;
      }
      if (baseline) {
        baseline = false;
        lastNow = now;
        return;
      }
      const elapsed = now - lastNow!;
      if (elapsed > 250 || dt > 250) {
        changePhase("suspended");
        return;
      }
      lastNow = now;
      advance = elapsed > 0 && dt > 0;
    },
    canAdvance: () => advance && !lifecycleRequest && phase === "flying",
  };
}
