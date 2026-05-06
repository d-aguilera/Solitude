import { createSpacecraftOperatorPlugin } from "solitude/plugins/spacecraftOperator/index";
import { describe, expect, it } from "vitest";
import type { ControlledBody } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import type { WorldAndSceneConfig } from "../configPorts";
import type { FocusContext } from "../runtimePorts";
import { buildViewDefinitions } from "../viewRegistry";

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
