import type { ExternalKeyboardInputProvider } from "@solitude/plugin-api/input";
import { keyboardInputCapability } from "@solitude/plugin-api/input";
import { vec3 } from "@solitude/plugin-api/math";
import { describe, expect, it } from "vitest";
import { createTestWorldAndBody } from "../shared/hudTest";
import { createPlugin } from "./index";

describe("main view lookaround plugin", () => {
  it("publishes shared look and camera-offset bindings", () => {
    const plugin = createPlugin({});
    const input = plugin.capabilities?.find(
      (capability) => capability.id === keyboardInputCapability,
    )?.value as ExternalKeyboardInputProvider | undefined;

    expect(input?.keyMap).toEqual({
      ArrowDown: "lookDown",
      ArrowLeft: "lookLeft",
      ArrowRight: "lookRight",
      ArrowUp: "lookUp",
      KeyI: "camUp",
      KeyJ: "camBackward",
      KeyK: "camDown",
      KeyR: "lookReset",
      KeyU: "camForward",
    });
  });

  it("updates main-view look and primary camera offset", () => {
    const { body } = createTestWorldAndBody();
    const lookState = { azimuth: 0, elevation: 0 };
    const cameraOffset = vec3.zero();

    createPlugin({}).viewControls?.updateViewControls?.({
      controlInput: {
        camForward: true,
        camUp: true,
        lookLeft: true,
        lookUp: true,
      },
      dtMillis: 100,
      mainFocus: { controlledBody: body, entityId: body.id },
      sceneControlState: { mainViewLookState: lookState },
      sceneState: { primaryView: { cameraOffset } },
    });

    expect(lookState.azimuth).toBeCloseTo(0.15);
    expect(lookState.elevation).toBeCloseTo(0.15);
    expect(cameraOffset.y).toBe(500);
    expect(cameraOffset.z).toBe(500);
  });
});
