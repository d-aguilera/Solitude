import { describe, expect, it, vi } from "vitest";
import { createSession } from "../adventure/session";

describe("adventure session clock and entry", () => {
  it("starts in briefing, requires Begin, clears input and rebases before flight", () => {
    const controller = createSession(4, "my-first-orbit", "en", () => true);
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
  it("rebases retry startup stalls before the first physics advance, then suspends real flight gaps", () => {
    const previous = createSession(1, "my-first-orbit", "es", () => true);
    previous.session.command("begin");
    previous.updateFrame(100, 16);
    previous.updateFrame(116, 16);
    previous.session.command("pause");
    previous.session.command("retry");
    const retry = createSession(2, "my-first-orbit", "es", () => true);
    retry.session.command("begin");
    retry.updateFrame(1000, 16);
    retry.updateFrame(1400, 400);
    expect(retry.session.phase).toBe("flying");
    expect(retry.canAdvance()).toBe(false);
    expect(retry.objective.latestSequence).toBe(0);
    retry.updateFrame(1800, 400);
    expect(retry.canAdvance()).toBe(false);
    retry.updateFrame(1816, 16);
    expect(retry.canAdvance()).toBe(true);
    retry.session.command("pause");
    retry.session.command("resume");
    retry.updateFrame(2000, 184);
    retry.updateFrame(2400, 400);
    expect(retry.session.phase).toBe("suspended");
    expect(retry.canAdvance()).toBe(false);
  });
  it("still suspends on focus loss before the first physics advance", () => {
    let focused = true;
    const controller = createSession(1, "my-first-orbit", "en", () => focused);
    controller.session.command("begin");
    controller.updateFrame(100, 16);
    focused = false;
    controller.updateFrame(500, 400);
    expect(controller.session.phase).toBe("suspended");
    expect(controller.canAdvance()).toBe(false);
  });
  it.each([
    [367, 251],
    [115, 16],
    [NaN, 16],
    [116, NaN],
  ])("suspends before a discontinuous tick (%s, %s)", (now, dt) => {
    const controller = createSession(1, "my-first-orbit", "es", () => true);
    controller.session.command("begin");
    controller.updateFrame(100, 16);
    controller.updateFrame(116, 16);
    controller.updateFrame(now, dt);
    expect(controller.session.phase).toBe("suspended");
    expect(controller.canAdvance()).toBe(false);
    controller.updateFrame(400, 16);
    expect(controller.session.phase).toBe("suspended");
  });
  it("allows exactly 250ms and skips repeated timestamps", () => {
    const controller = createSession(1, "my-first-orbit", "en", () => true);
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
    controller.session.command("begin");
    expect(controller.session.phase).toBe("briefing");
    expect(controller.session.getPresentation()?.actions[0].disabled).toBe(
      true,
    );
    focused = true;
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
