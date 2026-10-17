import type {
  ExternalPluginContext,
  ExternalPluginFactory,
} from "@solitude/plugin-api/module";
import { standaloneModeOption } from "@solitude/plugin-api/standalone-entry";
import { describe, expect, it, vi } from "vitest";
import { createPlugin as operatorSwitch } from "../composition/operator-switch";
import { createPlugin as pause } from "../composition/pause";
import { createPlugin as playback } from "../composition/playback";
import { selectSandboxPlugin } from "../composition/runSelection";
import { createPlugin as ships } from "../composition/ships";
import { createPlugin as timeScale } from "../composition/time-scale";
import { createPlugin as reusableSwitch } from "../operator-switch";
import { createPlugin as reusablePause } from "../pause";
import { createPlugin as reusablePlayback } from "../playback";
import { createPlugin as reusableShips } from "../ships";
import { createPlugin as reusableTimeScale } from "../time-scale";

// Factory creation retains this facade; no snapshot operation is needed here.
const context: ExternalPluginContext = {
  profiler: {
    check: vi.fn(),
    flush: vi.fn(),
    setEnabled: vi.fn(),
    setPaused: vi.fn(),
  },
  snapshots: {
    capture: vi.fn(() => ({ entities: [] })),
    apply: vi.fn(() => true),
  },
};
const adventure = { [standaloneModeOption]: "my-first-orbit", locale: "en" };

describe("standalone pack composition", () => {
  it("selects features before constructing them and forwards the host context", () => {
    const feature = { id: "example", hooks: {} };
    const factory = vi.fn<ExternalPluginFactory>(() => feature);
    const selected = selectSandboxPlugin("example", factory);
    expect(selected(adventure, context)).toEqual({ id: "example" });
    expect(factory).not.toHaveBeenCalled();
    const sandbox = { [standaloneModeOption]: "free-flight" };
    expect(selected(sandbox, context)).toBe(feature);
    expect(factory).toHaveBeenCalledExactlyOnceWith(sandbox, context);
  });

  it.each([
    ["pause", pause, reusablePause],
    ["playback", playback, reusablePlayback],
    ["timeScale", timeScale, reusableTimeScale],
    ["ships", ships, reusableShips],
    ["operatorSwitch", operatorSwitch, reusableSwitch],
  ] as const)(
    "owns %s activation while its reusable factory ignores scenario identity",
    (id, selected, reusable) => {
      expect(selected(adventure, context)).toEqual({ id });
      // Reusing the underlying feature in another composition does not silently
      // suppress it just because a content-specific option is present.
      const feature = reusable(adventure, context);
      expect(feature.id).toBe(id);
      expect(
        feature.capabilities?.length || Object.keys(feature.hooks ?? {}).length,
      ).toBeGreaterThan(0);
      const sandbox = selected(
        { [standaloneModeOption]: "free-flight", locale: "en" },
        context,
      );
      expect(sandbox.id).toBe(id);
      expect(
        sandbox.capabilities?.length || Object.keys(sandbox.hooks ?? {}).length,
      ).toBeGreaterThan(0);
    },
  );
});
