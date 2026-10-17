import { describe, expect, it } from "vitest";
import { createSessionClock } from "../adventure/clock";
import { createSessionPresentation } from "../adventure/presentation";
import { createSessionLifecycle } from "../adventure/session";

describe("session responsibility boundaries", () => {
  it("coordinates injected rules after publishing a blocked phase and before notifying input/listeners", () => {
    const events: string[] = [];
    const controller = createSessionLifecycle(
      7,
      "my-first-orbit",
      () => true,
      createSessionClock(true),
      createSessionPresentation("en"),
      {
        changePhase: (phase) => {
          expect(controller.session.phase).toBe(phase);
          expect(controller.canAdvance()).toBe(false);
          events.push(`rules:${phase}`);
        },
        block: (phase) => {
          expect(controller.session.lifecycleRequest).toBe("retry");
          expect(controller.canAdvance()).toBe(false);
          events.push(`blocked:${phase}`);
        },
      },
    );
    controller.session.attachInputReset(() => events.push("input"));
    controller.session.subscribe(() => events.push("notify"));
    controller.session.command("begin");
    controller.updateFrame(0, 16);
    controller.updateFrame(16, 16);
    expect(controller.canAdvance()).toBe(true);
    controller.session.command("pause");
    controller.session.command("retry");
    controller.session.command("resume");
    expect(events).toEqual([
      "rules:flying",
      "input",
      "notify",
      "rules:paused",
      "input",
      "notify",
      "blocked:paused",
      "input",
      "notify",
    ]);
  });

  it("keeps the first flight baseline independent of startup frames and resets it on resume", () => {
    const clock = createSessionClock(false);
    expect(clock.observeStartupFrame(0, 16, true)).toBe(false);
    expect(clock.observeStartupFrame(250, 250, true)).toBe(false);
    expect(clock.observeStartupFrame(500, 250, true)).toBe(true);
    expect(clock.updateFrame(10000, 9500)).toBe("hold");
    expect(clock.updateFrame(10250, 250)).toBe("advance");
    clock.rebase();
    expect(clock.updateFrame(20000, 9750)).toBe("hold");
    expect(clock.updateFrame(20016, 16)).toBe("advance");
    expect(clock.updateFrame(20267, 16)).toBe("suspend");
    expect(clock.ready).toBe(true);
  });

  it.each(["en", "es", "fr"] as const)(
    "projects all dialogs in %s without lifecycle effects",
    (locale) => {
      const presentation = createSessionPresentation(locale);
      const labels = presentation.labels;
      expect(
        presentation.project("free-flight", "flying", true, true),
      ).toBeNull();
      expect(
        presentation.project("my-first-orbit", "flying", true, true),
      ).toBeNull();
      expect(
        presentation.project("my-first-orbit", "briefing", false, true)
          ?.actions[0],
      ).toEqual({ command: "begin", label: labels.preparing, disabled: true });
      expect(
        presentation.project("my-first-orbit", "briefing", true, false)
          ?.actions[0],
      ).toEqual({ command: "begin", label: labels.begin, disabled: true });
      const cases = [
        ["paused", labels.paused, ""],
        ["suspended", labels.suspended, labels.suspensionBody],
        ["completed", labels.completed, labels.completedBody],
        ["failed", labels.failed, labels.failedBody],
      ] as const;
      for (const [phase, title, body] of cases) {
        const dialog = presentation.project(
          "my-first-orbit",
          phase,
          true,
          false,
        )!;
        expect(dialog).toMatchObject({ title, body });
        expect(dialog.actions.map((action) => action.command)).toEqual(
          phase === "paused" || phase === "suspended"
            ? ["resume", "retry", "menu"]
            : ["retry", "menu"],
        );
        if (dialog.actions[0].command === "resume")
          expect(dialog.actions[0].disabled).toBe(true);
      }
    },
  );
});
