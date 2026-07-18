import { localFrame, mat3, vec3, type LocalFrame } from "@solitude/engine/math";
import type { GamePlugin } from "@solitude/engine/plugin";
import type { Mesh, TextMetrics } from "@solitude/engine/render";
import {
  captureRuntimeSnapshot,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type { EntityConfig, WorldAndSceneConfig } from "@solitude/engine/world";
import { createWorld } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import {
  createRemoteWorldRenderer,
  rasterizeSceneOverlay,
} from "../../infra/remoteWorldRenderer";

const surface = {
  height: 600,
  width: 800,
};

function measureText(text: string, _font: string): TextMetrics {
  const width = text.length * 8;
  return {
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: width,
    alphabeticBaseline: 0,
    emHeightAscent: 8,
    emHeightDescent: 2,
    fontBoundingBoxAscent: 8,
    fontBoundingBoxDescent: 2,
    hangingBaseline: 0,
    ideographicBaseline: 0,
    width,
  };
}

describe("remote world renderer", () => {
  it("applies an authoritative snapshot before projecting overlays", () => {
    const config = buildConfig();
    const renderer = createRemoteWorldRenderer({
      config,
      measureText,
      plugins: [createForwardViewPlugin()],
      surface,
    });
    const snapshot = createAuthoritativeSnapshot(config, {
      x: 25,
      y: 10,
      z: 5,
    });

    expect(renderer.renderSnapshot(snapshot)).toBe(true);

    expect(
      renderer.mirror.worldSetup.mainFocus.controlledBody.position,
    ).toEqual(expect.objectContaining({ x: 25, y: 10, z: 5 }));
    expect(renderer.renderedView.segmentCount).toBe(0);
  });

  it("applies scene labels and segments before rendering", () => {
    const config = buildConfig();
    const renderer = createRemoteWorldRenderer({
      config,
      measureText,
      plugins: [
        createForwardViewPlugin(),
        {
          id: "test-render-contributions",
          labels: {
            appendLabels: (into, params) => {
              into.addLabel(
                "label:test",
                params.mainFocus.controlledBody.position,
                ["Test"],
              );
            },
          },
          segments: {
            appendSegments: (into, params) => {
              into.addSegment(
                params.mainFocus.controlledBody.position,
                vec3.create(0, 10, 0),
                { r: 255, g: 255, b: 255 },
                1,
              );
            },
          },
        },
      ],
      surface,
    });

    expect(renderer.renderSnapshot(createAuthoritativeSnapshot(config))).toBe(
      true,
    );

    expect(renderer.renderedView.sceneLabelCount).toBe(1);
    expect(renderer.renderedView.segmentCount).toBe(1);
  });

  it("can switch focus between mirrored controllable entities", () => {
    const config = buildConfig([createCraft("craft:red", 8)]);
    const renderer = createRemoteWorldRenderer({
      config,
      measureText,
      plugins: [createForwardViewPlugin()],
      surface,
    });

    expect(renderer.setFocusEntityId("craft:red")).toBe(true);
    expect(renderer.setFocusEntityId("planet:missing")).toBe(false);
    expect(renderer.renderSnapshot(createAuthoritativeSnapshot(config))).toBe(
      true,
    );

    expect(renderer.mirror.worldSetup.mainFocus.entityId).toBe("craft:red");
  });

  it("applies remote view controls before updating cameras", () => {
    const config = buildConfig();
    const renderer = createRemoteWorldRenderer({
      config,
      measureText,
      plugins: [
        createForwardViewPlugin(),
        {
          id: "test-view-controls",
          viewControls: {
            updateViewControls: ({
              controlInput,
              dtMillis,
              sceneControlState,
            }) => {
              if (controlInput.lookUp) {
                sceneControlState.mainViewLookState.elevation += dtMillis;
              }
            },
          },
        },
      ],
      surface,
    });

    expect(
      renderer.renderSnapshot(createAuthoritativeSnapshot(config), {
        controlInput: { lookUp: true },
        dtMillis: 2,
      }),
    ).toBe(true);

    expect(config.render.mainViewLookState?.elevation).toBe(2);
  });

  it("can rasterize an already projected scene overlay", () => {
    const config = buildConfig();
    const renderer = createRemoteWorldRenderer({
      config,
      measureText,
      plugins: [createForwardViewPlugin()],
      surface,
    });
    const calls: string[] = [];
    renderer.renderSnapshot(createAuthoritativeSnapshot(config));

    rasterizeSceneOverlay(renderer.renderedView, {
      clear: () => calls.push("clear"),
      drawMarkers: (_markers, count) => calls.push(`markers:${count}`),
      drawSceneLabels: (_labels, count) => calls.push(`labels:${count}`),
    });

    expect(calls).toEqual(["clear", "markers:0", "labels:0"]);
  });
});

function createForwardViewPlugin(): GamePlugin {
  return {
    id: "test-forward-view",
    views: {
      registerViews: (registry) => {
        registry.addMainViewCameraRig({
          id: "test.forward",
          updateFrame: ({ frame }) => {
            localFrame.copyInto(frame, createForwardFrame());
          },
        });
      },
    },
  };
}

function buildConfig(extraEntities: EntityConfig[] = []): WorldAndSceneConfig {
  const craft = createCraft("craft:test", 0);

  return {
    entities: [craft, ...extraEntities],
    mainFocusEntityId: craft.id,
    render: {
      mainViewCameraOffset: vec3.create(0, -20, 0),
      mainViewLookState: { azimuth: 0, elevation: 0 },
    },
  };
}

function createCraft(id: string, x: number): EntityConfig {
  const frame = createForwardFrame();
  return {
    id,
    components: {
      controllable: { enabled: true },
      gravityMass: { density: 1, volume: 1 },
      renderable: {
        color: { b: 80, g: 140, r: 220 },
        mesh: createTriangleMesh(),
        meshLod: { kind: "none" },
        meshShading: { kind: "flat" },
        meshScale: 1,
        role: "controlledBody",
      },
      state: {
        angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
        frame,
        kind: "direct",
        orientation: localFrame.intoMat3(mat3.zero(), frame),
        position: vec3.create(x, 0, 0),
        velocity: vec3.zero(),
      },
    },
  };
}

function createForwardFrame(): LocalFrame {
  return {
    forward: vec3.create(0, 1, 0),
    right: vec3.create(1, 0, 0),
    up: vec3.create(0, 0, 1),
  };
}

function createTriangleMesh(): Mesh {
  return {
    faces: [[0, 1, 2]],
    points: [
      vec3.create(-1, 15, -1),
      vec3.create(1, 15, -1),
      vec3.create(0, 15, 1),
    ],
  };
}

function createAuthoritativeSnapshot(
  config: WorldAndSceneConfig,
  position = { x: 0, y: 0, z: 0 },
): RuntimeWorldSnapshot {
  const authoritative = createWorld(config);
  const controlledBody = authoritative.mainFocus.controlledBody;
  controlledBody.position.x = position.x;
  controlledBody.position.y = position.y;
  controlledBody.position.z = position.z;
  return captureRuntimeSnapshot(authoritative.world);
}
