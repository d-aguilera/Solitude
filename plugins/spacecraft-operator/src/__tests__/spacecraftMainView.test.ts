import { mat3, vec3 } from "@solitude/plugin-api/math";
import type { ExternalMainViewCameraRig } from "@solitude/plugin-api/views";
import type {
  ExternalControlledBody,
  ExternalFocusContext,
} from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import { createPlugin } from "../index";
import { localFrame } from "../localFrame";

function createBody(id: string, upX: number): ExternalControlledBody {
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
    const mainFocus: ExternalFocusContext = {
      controlledBody: focusedBody,
      entityId: focusedBody.id,
    };
    let primaryView: ExternalMainViewCameraRig | undefined;
    createPlugin().hooks?.views?.registerViews(
      {
        addMainViewCameraRig: (rig) => {
          primaryView = rig;
        },
        addView: () => {},
      },
      undefined as never,
    );

    primaryView?.updateFrame({
      frame,
      mainFocus,
      mainViewLookState: { azimuth: 0, elevation: 0 },
    });

    expect(primaryView?.id).toBe("spacecraft.forward");
    expect(frame.forward).toEqual(focusedBody.frame.forward);
  });
});
