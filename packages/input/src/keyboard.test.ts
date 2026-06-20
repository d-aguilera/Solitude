import type { PluginCapabilityProvider } from "@solitude/engine/plugin";
import { describe, expect, it } from "vitest";
import {
  collectKeyboardInputProviders,
  createKeyboardInputProvider,
  type KeyboardInputProvider,
} from "./keyboard";

describe("keyboard input providers", () => {
  it("collects capability-backed providers in plugin order", () => {
    const first: KeyboardInputProvider = { keyMap: { KeyA: "first" } };
    const second: KeyboardInputProvider = { keyMap: { KeyB: "second" } };
    const capabilities: PluginCapabilityProvider[] = [
      createKeyboardInputProvider(first),
      { id: "unrelated", value: {} },
      createKeyboardInputProvider(second),
    ];

    expect(collectKeyboardInputProviders(capabilities)).toEqual([
      first,
      second,
    ]);
  });
});
