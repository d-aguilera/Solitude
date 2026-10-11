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

it("suspends on blur/visibility loss and detaches listeners with the run", () => {
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    hasFocus: () => true,
  });
  const windowTarget = new EventTarget();
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("window", windowTarget);
  const plugin = createPlugin({ [standaloneModeOption]: "my-first-orbit" });
  const session = plugin
    .capabilities!.map((p) => p.value)
    .find(isStandaloneSession)!;
  const dispose = plugin.hooks!.loop!.initLoop!() as () => void;
  windowTarget.dispatchEvent(new Event("blur"));
  expect(session.phase).toBe("briefing");
  for (let i = 0; i <= 30; i++)
    plugin.hooks!.loop!.afterFrame!({
      nowMs: (i * 1000) / 60,
      dtMillis: 1000 / 60,
    } as ExternalLoopUpdateParams);
  session.command("begin");
  windowTarget.dispatchEvent(new Event("blur"));
  expect(session.phase).toBe("suspended");
  windowTarget.dispatchEvent(new Event("blur"));
  expect(session.phase).toBe("suspended");
  session.command("resume");
  documentTarget.visibilityState = "hidden";
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  expect(session.phase).toBe("suspended");
  dispose();
  documentTarget.visibilityState = "visible";
  session.command("resume");
  windowTarget.dispatchEvent(new Event("blur"));
  expect(session.phase).toBe("flying");
});
