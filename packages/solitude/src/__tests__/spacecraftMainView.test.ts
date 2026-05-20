import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import { buildViewDefinitions } from "@solitude/engine/render";
import type { FocusContext } from "@solitude/engine/runtime";
import type {
  ControlledBody,
  WorldAndSceneConfig,
} from "@solitude/engine/world";
import { createSpacecraftOperatorPlugin } from "solitude/plugins/spacecraftOperator/index";
import { describe, expect, it } from "vitest";

function createBody(id: string, upX: number): ControlledBody {
  return {
    id,
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame: localFrame.fromUp(vec3.create(upX, 0, 1)),
    orientation: mat3.identity,
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

describe("main view camera frame", () => {
  it("uses the spacecraft main-view rig for the focused body frame", () => {
    const focusedBody = createBody("craft:focus", 0.25);
    const frame = localFrame.zero();
    const mainFocus: FocusContext = {
      controlledBody: focusedBody,
      entityId: focusedBody.id,
    };
    const config: WorldAndSceneConfig = {
      entities: [],
      mainFocusEntityId: focusedBody.id,
      render: {
        mainViewCameraOffset: vec3.zero(),
        mainViewLookState: { azimuth: 0, elevation: 0 },
      },
    };
    const [primaryView] = buildViewDefinitions(config, [
      createSpacecraftOperatorPlugin(),
    ]);

    primaryView.updateFrame({
      frame,
      mainFocus,
      mainViewLookState: { azimuth: 0, elevation: 0 },
    });

    expect(frame.forward).toEqual(focusedBody.frame.forward);
  });
});
