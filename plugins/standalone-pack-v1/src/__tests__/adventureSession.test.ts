import { describe, expect, it, vi } from "vitest";
import { createSession } from "../adventure/composition";
import { prepareStartup } from "./startupFixture";

describe("adventure session clock and entry", () => {
  it("starts in briefing, requires Begin, clears input and rebases before flight", () => {
    const controller = createSession(4, "my-first-orbit", "en", () => true);
    prepareStartup(controller);
    const reset = vi.fn();
    controller.session.attachInputReset(reset);
    expect(controller.session.phase).toBe("briefing");
    controller.session.command("resume");
    controller.updateFrame(100, 16);
    expect(controller.canAdvance()).toBe(false);
    controller.session.command("begin");
    expect(reset).toHaveBeenCalledOnce();
    controller.updateFrame(10000, 9000);
    expect(controller.canAdvance()).toBe(false);
    controller.updateFrame(10016, 16);
    expect(controller.canAdvance()).toBe(true);
    controller.session.command("pause");
    expect(controller.canAdvance()).toBe(false);
    controller.session.command("resume");
    controller.updateFrame(20000, 9984);
    expect(controller.canAdvance()).toBe(false);
    controller.updateFrame(20016, 16);
    expect(controller.canAdvance()).toBe(true);
  });
  it.each([
    [351, 251],
    [99, 16],
    [NaN, 16],
    [116, NaN],
  ])("suspends before a discontinuous tick (%s, %s)", (now, dt) => {
    const controller = createSession(1, "my-first-orbit", "es", () => true);
    prepareStartup(controller);
    controller.session.command("begin");
    controller.updateFrame(100, 16);
    controller.updateFrame(now, dt);
    expect(controller.session.phase).toBe("suspended");
    expect(controller.canAdvance()).toBe(false);
    controller.updateFrame(400, 16);
    expect(controller.session.phase).toBe("suspended");
  });
  it("allows exactly 250ms and skips repeated timestamps", () => {
    const controller = createSession(1, "my-first-orbit", "en", () => true);
    prepareStartup(controller);
    controller.session.command("begin");
    controller.updateFrame(100, 16);
    controller.updateFrame(350, 250);
    expect(controller.canAdvance()).toBe(true);
    controller.updateFrame(350, 0);
    expect(controller.canAdvance()).toBe(false);
    expect(controller.session.phase).toBe("flying");
  });
  it("requires explicit resume after focus loss and retains briefing/paused phases", () => {
    let focused = false;
    const controller = createSession(1, "my-first-orbit", "fr", () => focused);
    prepareStartup(controller);
    controller.session.command("begin");
    expect(controller.session.phase).toBe("briefing");
    expect(controller.session.getPresentation()?.actions[0].disabled).toBe(
      true,
    );
    focused = true;
    prepareStartup(controller);
    controller.session.command("begin");
    focused = false;
    controller.suspend();
    focused = true;
    controller.refresh();
    expect(controller.session.phase).toBe("suspended");
    controller.session.command("resume");
    controller.session.command("pause");
    controller.suspend();
    expect(controller.session.phase).toBe("paused");
  });
  it("stops immediately on retry/menu and consumes only the first lifecycle request", () => {
    const controller = createSession(1, "my-first-orbit", "en", () => true);
    prepareStartup(controller);
    controller.session.command("begin");
    controller.updateFrame(100, 16);
    controller.updateFrame(116, 16);
    const listener = vi.fn();
    const remove = controller.session.subscribe(listener);
    controller.session.command("retry");
    controller.session.command("menu");
    expect(controller.canAdvance()).toBe(false);
    expect(controller.session.lifecycleRequest).toBe("retry");
    expect(listener).toHaveBeenCalledOnce();
    remove();
  });
});

describe("adventure presentation readiness", () => {
  it.each([449.8, 466.4, 483.2, 499.9, 516.5, 549.9])(
    "keeps Begin gated through a captured %s ms startup stall without flight credit",
    (gap) => {
      const c = createSession(2, "my-first-orbit", "es", () => true);
      const listener = vi.fn();
      c.session.subscribe(listener);
      c.observeStartupFrame(0, 16);
      c.observeStartupFrame(16, 16);
      c.session.command("begin");
      expect(c.session.phase).toBe("briefing");
      expect(c.session.getPresentation()!.actions[0]).toMatchObject({
        label: "Preparando el vuelo…",
        disabled: true,
      });
      c.observeStartupFrame(16 + gap, gap);
      c.observeStartupFrame(216 + gap, 200);
      c.observeStartupFrame(416 + gap, 200);
      expect(c.session.getPresentation()!.actions[0].disabled).toBe(true);
      c.observeStartupFrame(616 + gap, 200);
      expect(c.session.getPresentation()!.actions[0]).toMatchObject({
        label: "Comenzar",
        disabled: false,
      });
      expect(listener).toHaveBeenCalledOnce();
      expect(c.canAdvance()).toBe(false);
      expect(c.objective.latestSequence).toBe(0);
      expect(c.objective.coastMillis).toBe(0);
      c.session.command("begin");
      c.updateFrame(632 + gap, 16);
      expect(c.canAdvance()).toBe(false);
      c.updateFrame(648 + gap, 16);
      expect(c.canAdvance()).toBe(true);
      c.updateFrame(648 + gap + 300, 300);
      expect(c.session.phase).toBe("suspended");
    },
  );
  it("resets the startup streak on focus loss, invalid clocks, and duplicate timestamps", () => {
    let focused = true;
    const c = createSession(1, "my-first-orbit", "en", () => focused);
    c.observeStartupFrame(0, 16);
    c.observeStartupFrame(250, 250);
    focused = false;
    c.suspend();
    focused = true;
    c.observeStartupFrame(500, 250);
    c.observeStartupFrame(750, 250);
    expect(c.session.getPresentation()!.actions[0].disabled).toBe(true);
    c.observeStartupFrame(NaN, 16);
    c.observeStartupFrame(1000, 250);
    c.observeStartupFrame(1250, 250);
    c.observeStartupFrame(1250, 0);
    c.observeStartupFrame(1500, 250);
    expect(c.session.getPresentation()!.actions[0].disabled).toBe(true);
    c.observeStartupFrame(1750, 250);
    expect(c.session.getPresentation()!.actions[0].disabled).toBe(false);
  });
  it("requires fresh readiness after Retry and keeps Return to menu available while preparing", () => {
    const first = createSession(1, "my-first-orbit", "en", () => true);
    prepareStartup(first);
    first.session.command("begin");
    first.session.command("retry");
    const retry = createSession(2, "my-first-orbit", "en", () => true);
    expect(retry.session.getPresentation()!.actions[0].disabled).toBe(true);
    expect(retry.session.getPresentation()!.actions[1]).toMatchObject({
      command: "menu",
      disabled: false,
    });
    retry.session.command("begin");
    expect(retry.session.phase).toBe("briefing");
    retry.session.command("menu");
    prepareStartup(retry);
    expect(retry.session.lifecycleRequest).toBe("menu");
    expect(retry.session.getPresentation()!.actions[0].disabled).toBe(true);
  });
});
