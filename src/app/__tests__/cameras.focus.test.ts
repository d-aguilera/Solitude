import { describe, expect, it } from "vitest";
import type { ControlledBody } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { updateMainViewFrame } from "../cameras";
import type { FocusContext } from "../runtimePorts";

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
  it("uses mainFocus instead of the legacy mainControlledBody alias", () => {
    const focusedBody = createBody("ship:focus", 0.25);
    const frame = localFrame.zero();
    const mainFocus: FocusContext = {
      controlledBody: focusedBody,
      entityId: focusedBody.id,
    };

    updateMainViewFrame({
      frame,
      mainFocus,
      mainViewLookState: { azimuth: 0, elevation: 0 },
    });

    expect(frame.forward).toEqual(focusedBody.frame.forward);
  });
});
