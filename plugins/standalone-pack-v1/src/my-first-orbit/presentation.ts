import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type { StandaloneMode } from "@solitude/plugin-api/standalone-entry";
import type {
  StandaloneCommand,
  StandalonePhase,
  StandalonePresentation,
} from "@solitude/plugin-api/standalone-session";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

/** Localized projection only; reading a dialog never mutates the run. */
export function createSessionPresentation(locale: ExternalLocale) {
  const messages = { en, es, fr }[locale];
  return {
    labels: messages,
    project: (
      mode: StandaloneMode,
      phase: StandalonePhase,
      presentationReady: boolean,
      canFly: boolean,
    ): StandalonePresentation | null => {
      if (mode === "free-flight" || phase === "flying") return null;
      const actions: {
        command: StandaloneCommand;
        label: string;
        disabled: boolean;
      }[] = [];
      if (phase === "briefing")
        actions.push({
          command: "begin",
          label: presentationReady ? messages.begin : messages.preparing,
          disabled: !presentationReady || !canFly,
        });
      else {
        if (phase === "paused" || phase === "suspended")
          actions.push({
            command: "resume",
            label: messages.resume,
            disabled: !canFly,
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
}
