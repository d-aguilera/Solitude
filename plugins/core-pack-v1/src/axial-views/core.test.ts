import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import type { ExternalViewDefinition } from "@solitude/plugin-api/views";
import type { ExternalLocalFrame } from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import { createPlugin } from "./index";

describe("axial view plugin", () => {
  it("places the front camera ahead of the craft and points it back", () => {
    const front = getView("front");
    expect(front.initialCameraOffset).toEqual(vec3.create(0, 500_000, 4_850));

    const frame = createFrame(vec3.zero(), vec3.zero(), vec3.zero());
    front.updateFrame({
      frame,
      mainFocus: {
        controlledBody: {
          frame: createFrame(
            vec3.create(0, 1, 0),
            vec3.create(1, 0, 0),
            vec3.create(0, 0, 1),
          ),
          id: "ship:test",
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

  it("uses the locale supplied by the host", () => {
    expect(getView("front", { locale: "fr" }).title).toBe("Avant");
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

function getView(
  id: string,
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalViewDefinition {
  const views: ExternalViewDefinition[] = [];
  createPlugin(runtimeOptions).views?.registerViews(
    {
      addMainViewCameraRig: () => {},
      addView: (view) => views.push(view),
    },
    { config: { entities: [] } },
  );
  const view = views.find((item) => item.id === id);
  if (!view) throw new Error(`Missing view: ${id}`);
  return view;
}

function createFrame(
  forward: ReturnType<typeof vec3.create>,
  right: ReturnType<typeof vec3.create>,
  up: ReturnType<typeof vec3.create>,
): ExternalLocalFrame {
  return { forward, right, up };
}
