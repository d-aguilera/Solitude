import { vec3 } from "@solitude/engine/math";
import type { ViewControlUpdateParams } from "@solitude/engine/plugin";
import type { SceneState } from "@solitude/engine/render";
import type { FocusContext } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import { createViewControlPlugin } from "./core";

describe("mainViewLookaround", () => {
  it("updates main-view look and primary camera offset from plugin input", () => {
    const lookState = { azimuth: 0, elevation: 0 };
    const primaryView = {
      definition: {
        id: "primary",
        labelMode: "full",
        initialCameraOffset: vec3.zero(),
        layout: { kind: "primary" },
        updateFrame: () => {},
      },
      camera: {
        position: vec3.zero(),
        frame: {
          forward: vec3.zero(),
          right: vec3.zero(),
          up: vec3.zero(),
        },
      },
      cameraOffset: vec3.zero(),
    } satisfies SceneState["primaryView"];

    createViewControlPlugin().updateViewControls?.({
      controlInput: {
        camForward: true,
        camUp: true,
        lookLeft: true,
        lookUp: true,
      },
      dtMillis: 100,
      mainFocus: {} as FocusContext,
      sceneControlState: { mainViewLookState: lookState },
      sceneState: {
        primaryView,
        views: [primaryView],
      },
    } satisfies ViewControlUpdateParams);

    expect(lookState.azimuth).toBeCloseTo(0.15);
    expect(lookState.elevation).toBeCloseTo(0.15);
    expect(primaryView.cameraOffset.y).toBe(500);
    expect(primaryView.cameraOffset.z).toBe(500);
  });
});
