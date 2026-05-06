import { createControlInput } from "@solitude/engine/app/controlPorts";
import type { KeyHandler } from "@solitude/engine/app/pluginPorts";
import { describe, expect, it, vi } from "vitest";
import { createInputPlugin } from "./input";

describe("playback input", () => {
  it("allows profiling toggle through while playback input is locked", () => {
    const handler = createPlaybackHandler(true);

    expect(handler.handleKeyDown("profilingToggle", false)).toBe(false);
    expect(handler.handleKeyUp("profilingToggle")).toBe(false);
  });

  it("still locks playback-owned controls while allowing pause handling", () => {
    const handlePause = vi.fn();
    const handler = createPlaybackHandler(true, handlePause);

    expect(handler.handleKeyDown("burnForward", false)).toBe(true);
    expect(handler.handleKeyUp("burnForward")).toBe(true);

    expect(handler.handleKeyDown("pauseToggle", false)).toBe(true);
    expect(handlePause).toHaveBeenCalledTimes(1);
  });
});

function createPlaybackHandler(
  isInputLocked: boolean,
  handlePause = vi.fn(),
): KeyHandler {
  const plugin = createInputPlugin(
    { mode: "playback", scenario: "moon-circle" },
    {
      handlePause,
      isInputLocked: () => isInputLocked,
    } as unknown as Parameters<typeof createInputPlugin>[1],
  );
  const handler = plugin.createKeyHandler?.(createControlInput());
  if (!handler) throw new Error("Expected playback key handler");
  return handler;
}
