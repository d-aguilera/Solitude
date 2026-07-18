import type { GamePlugin } from "@solitude/engine/plugin";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initInput } from "../../infra/domKeyboardInput";

describe("domKeyboardInput", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wires DOM key events through the shared keyboard dispatcher", () => {
    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(
        (type: string, listener: (event: KeyboardEvent) => void) => {
          listeners.set(type, listener);
        },
      ),
    });
    const plugin: GamePlugin = {
      id: "testInput",
      capabilities: [
        createKeyboardInputProvider({
          keyMap: { KeyF: "testFire" },
        }),
      ],
    };

    const { controlInput } = initInput([plugin]);
    const keyDown = createKeyboardEvent("KeyF", false);
    const keyUp = createKeyboardEvent("KeyF", false);

    listeners.get("keydown")?.(keyDown);
    expect(controlInput.testFire).toBe(true);
    expect(keyDown.preventDefault).toHaveBeenCalledTimes(1);

    listeners.get("keyup")?.(keyUp);
    expect(controlInput.testFire).toBe(false);
    expect(keyUp.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("leaves unmapped DOM key events alone", () => {
    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(
        (type: string, listener: (event: KeyboardEvent) => void) => {
          listeners.set(type, listener);
        },
      ),
    });

    initInput([]);
    const keyDown = createKeyboardEvent("KeyF", false);

    listeners.get("keydown")?.(keyDown);
    expect(keyDown.preventDefault).not.toHaveBeenCalled();
  });
});

function createKeyboardEvent(
  code: string,
  repeat: boolean,
): KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> } {
  return {
    code,
    preventDefault: vi.fn(),
    repeat,
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}
