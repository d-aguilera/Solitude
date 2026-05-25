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
  rasterizeRenderedView,
} from "./remoteWorldRenderer";

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
  it("renders an authoritative snapshot through the engine renderer", () => {
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
    expect(renderer.renderedView.faceCount).toBe(1);
    expect(renderer.renderedView.faces[0].p0.x).toBeGreaterThan(0);
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
              into.push({
                anchor: params.mainFocus.controlledBody.position,
                id: "label:test",
                lines: ["Test"],
              });
            },
          },
          segments: {
            appendSegments: (into, params) => {
              into.push({
                cssColor: "white",
                end: vec3.create(0, 10, 0),
                lineWidth: 1,
                start: params.mainFocus.controlledBody.position,
              });
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

  it("can rasterize an already rendered view", () => {
    const config = buildConfig();
    const renderer = createRemoteWorldRenderer({
      config,
      measureText,
      plugins: [createForwardViewPlugin()],
      surface,
    });
    const calls: string[] = [];
    renderer.renderSnapshot(createAuthoritativeSnapshot(config));

    rasterizeRenderedView(renderer.renderedView, {
      clear: (color) => calls.push(`clear:${color}`),
      drawFaces: (_faces, count) => calls.push(`faces:${count}`),
      drawPolylines: (_polylines, count) => calls.push(`polylines:${count}`),
      drawSceneLabels: (_labels, count) => calls.push(`labels:${count}`),
      drawSegments: (_segments, count) => calls.push(`segments:${count}`),
      measureText,
    });

    expect(calls).toEqual([
      "clear:#000000",
      "faces:1",
      "polylines:0",
      "segments:0",
      "labels:0",
    ]);
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

function buildConfig(): WorldAndSceneConfig {
  const frame = createForwardFrame();
  const craft: EntityConfig = {
    id: "craft:test",
    components: {
      controllable: { enabled: true },
      gravityMass: { density: 1, volume: 1 },
      renderable: {
        color: { b: 80, g: 140, r: 220 },
        mesh: createTriangleMesh(),
        role: "controlledBody",
      },
      state: {
        angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
        frame,
        kind: "direct",
        orientation: localFrame.intoMat3(mat3.zero(), frame),
        position: vec3.zero(),
        velocity: vec3.zero(),
      },
    },
  };

  return {
    entities: [craft],
    mainFocusEntityId: craft.id,
    render: {
      mainViewCameraOffset: vec3.create(0, -20, 0),
      mainViewLookState: { azimuth: 0, elevation: 0 },
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
