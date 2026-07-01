import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type { ViewDefinition } from "@solitude/engine/render";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createAxialViewsPlugin } from "./index";

describe("axial view plugin", () => {
  it("places the front camera ahead of the craft and points it back at the craft", () => {
    const front = getView("front");
    expect(front.initialCameraOffset).toEqual(vec3.create(0, 500_000, 4_850));

    const frame = localFrame.zero();
    front.updateFrame({
      frame,
      mainFocus: {
        controlledBody: {
          angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
          frame: localFrame.clone({
            forward: vec3.create(0, 1, 0),
            right: vec3.create(1, 0, 0),
            up: vec3.create(0, 0, 1),
          }),
          id: "ship:test",
          orientation: mat3.identity,
          position: vec3.zero(),
          velocity: vec3.zero(),
        },
        entityId: "ship:test",
      },
      mainViewLookState: { azimuth: 0, elevation: 0 },
    });

    expectVec3Close(frame.forward, vec3.create(0, -1, 0));
    expectVec3Close(frame.right, vec3.create(-1, 0, 0));
    expectVec3Close(frame.up, vec3.create(0, 0, 1));
  });
});

function expectVec3Close(
  actual: ReturnType<typeof vec3.create>,
  expected: ReturnType<typeof vec3.create>,
): void {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
}

function getView(id: string): ViewDefinition {
  const views: ViewDefinition[] = [];
  createAxialViewsPlugin().views?.registerViews?.(
    {
      addMainViewCameraRig: () => {},
      addView: (view) => views.push(view),
    },
    {
      config: { entities: [] } as unknown as WorldAndSceneConfig,
    },
  );
  const view = views.find((item) => item.id === id);
  if (!view) throw new Error(`Missing view: ${id}`);
  return view;
}
