import type { ExternalLoopUpdateParams } from "@solitude/plugin-api/loop";
import {
  isStandaloneSession,
  standaloneModeOption,
} from "@solitude/plugin-api/standalone-session";
import { afterEach, expect, it, vi } from "vitest";
import { createPlugin } from "../adventure";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reports the precise frame suspension cause without retaining a mutable diagnostic", () => {
  let focused = true;
  vi.stubGlobal("document", {
    visibilityState: "visible",
    hasFocus: () => focused,
  });
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const plugin = createPlugin({ [standaloneModeOption]: "my-first-orbit" });
  const session = plugin
    .capabilities!.map((p) => p.value)
    .find(isStandaloneSession)!;
  const frame = (nowMs: number, dtMillis: number) =>
    plugin.hooks!.loop!.updateLoopState!({
      nowMs,
      dtMillis,
      controlInput: {},
    } as ExternalLoopUpdateParams);
  for (let i = 0; i <= 30; i++)
    plugin.hooks!.loop!.afterFrame!({
      nowMs: (i * 1000) / 60,
      dtMillis: 1000 / 60,
    } as ExternalLoopUpdateParams);
  session.command("begin");
  frame(100, 16);
  expect(log).not.toHaveBeenCalled();
  frame(400, 300);
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "[My First Orbit] Flight suspended",
    {
      generation: 0,
      source: "frame",
      reason: "frame-gap",
      nowMs: 400,
      dtMillis: 300,
      elapsedMillis: 300,
      focused: true,
      visibility: "visible",
    },
  );
  const firstDiagnostic = log.mock.calls[0][1];
  frame(500, 100);
  expect(log).toHaveBeenCalledOnce();
  session.command("resume");
  frame(600, 16);
  frame(NaN, 16);
  expect(log.mock.calls[1][1]).toMatchObject({
    reason: "invalid-clock",
    nowMs: NaN,
  });
  expect(firstDiagnostic).toMatchObject({ reason: "frame-gap", nowMs: 400 });
  session.command("resume");
  focused = false;
  frame(700, 16);
  expect(log.mock.calls[2][1]).toMatchObject({
    reason: "focus-or-visibility",
    focused: false,
  });
});

it("reports blur/visibility transitions once and detaches diagnostics with the run", () => {
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    hasFocus: () => true,
  });
  const windowTarget = new EventTarget();
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("window", windowTarget);
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const plugin = createPlugin({ [standaloneModeOption]: "my-first-orbit" });
  const session = plugin
    .capabilities!.map((p) => p.value)
    .find(isStandaloneSession)!;
  const dispose = plugin.hooks!.loop!.initLoop!() as () => void;
  windowTarget.dispatchEvent(new Event("blur"));
  expect(log).not.toHaveBeenCalled();
  for (let i = 0; i <= 30; i++)
    plugin.hooks!.loop!.afterFrame!({
      nowMs: (i * 1000) / 60,
      dtMillis: 1000 / 60,
    } as ExternalLoopUpdateParams);
  session.command("begin");
  windowTarget.dispatchEvent(new Event("blur"));
  expect(log.mock.calls[0][1]).toMatchObject({
    source: "blur",
    reason: "blur",
    dtMillis: null,
  });
  windowTarget.dispatchEvent(new Event("blur"));
  expect(log).toHaveBeenCalledOnce();
  session.command("resume");
  documentTarget.visibilityState = "hidden";
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  expect(log.mock.calls[1][1]).toMatchObject({
    source: "visibilitychange",
    visibility: "hidden",
  });
  dispose();
  documentTarget.visibilityState = "visible";
  session.command("resume");
  windowTarget.dispatchEvent(new Event("blur"));
  expect(log).toHaveBeenCalledTimes(2);
  expect(session.phase).toBe("flying");
});
