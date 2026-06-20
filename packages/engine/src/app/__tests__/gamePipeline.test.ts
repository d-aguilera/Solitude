import { describe, expect, it } from "vitest";
import type { GravityEngine } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { createControlInput } from "../controlPorts";
import { createGamePipeline } from "../gamePipeline";
import type { GamePlugin } from "../pluginPorts";
import type { WorldAndScene } from "../runtimePorts";
import type { ViewDefinition } from "../viewPorts";

describe("gamePipeline", () => {
  it("owns frame policy, simulation, scene, view, and contribution order", () => {
    const events: string[] = [];
    const worldAndScene = createWorldAndScene();
    const plugin: GamePlugin = {
      id: "pipeline-test",
      loop: {
        initLoop: () => events.push("loop:init"),
        updateLoopState: () => {
          events.push("loop:update");
          return { framePolicy: { simDtMillis: 8 } };
        },
        afterFrame: () => events.push("loop:after"),
      },
      simulation: {
        beforeGravity: () => events.push("simulation"),
      },
      scene: {
        initScene: () => events.push("scene:init"),
        updateScene: () => events.push("scene:update"),
      },
      viewControls: {
        updateViewControls: () => events.push("view:update"),
      },
      labels: {
        appendLabels: (into) => {
          events.push("labels");
          into.push({ anchor: vec3.zero(), id: "label", lines: ["Label"] });
        },
      },
      segments: {
        appendSegments: (into) => {
          events.push("segments");
          into.push({
            color: { r: 255, g: 255, b: 255 },
            end: vec3.zero(),
            lineWidth: 1,
            start: vec3.zero(),
          });
        },
      },
    };
    const gravityEngine: GravityEngine = {
      step: () => events.push("gravity"),
    };
    const pipeline = createGamePipeline({
      config: {
        entities: [],
        mainFocusEntityId: "craft:test",
        render: {
          mainViewCameraOffset: vec3.zero(),
          mainViewLookState: { azimuth: 0, elevation: 0 },
        },
      },
      controlInput: createControlInput(),
      gravityEngine,
      plugins: [plugin],
      viewDefinitions: [createViewDefinition()],
      worldAndScene,
    });

    const frame = pipeline.beginFrame(100, 16);
    pipeline.prepareView(pipeline.views[0], true, true);
    pipeline.endFrame();

    expect(frame.simTimeMillis).toBe(8);
    expect(events[0]).toBe("loop:init");
    expect(events[1]).toBe("scene:init");
    expect(events.indexOf("loop:update")).toBeLessThan(
      events.indexOf("simulation"),
    );
    expect(events.indexOf("simulation")).toBeLessThan(
      events.indexOf("view:update"),
    );
    expect(events.indexOf("view:update")).toBeLessThan(
      events.indexOf("scene:update"),
    );
    expect(events.slice(-3)).toEqual(["labels", "segments", "loop:after"]);
    expect(pipeline.views[0].sceneLabelCandidates).toHaveLength(1);
    expect(pipeline.views[0].worldSegments).toHaveLength(1);
  });
});

function createWorldAndScene(): WorldAndScene {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  const controlledBody = {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "craft:test",
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
  return {
    mainFocus: { controlledBody, entityId: controlledBody.id },
    scene: { lights: [], objects: [] },
    world: {
      axialSpins: [],
      collisionSpheres: [],
      controllableBodies: [controlledBody],
      entities: [{ id: controlledBody.id }],
      entityIndex: new Map([[controlledBody.id, { id: controlledBody.id }]]),
      entityStates: [controlledBody],
      gravityMasses: [],
      lightEmitters: [],
    },
  };
}

function createViewDefinition(): ViewDefinition {
  return {
    id: "primary",
    initialCameraOffset: vec3.zero(),
    labelMode: "full",
    layout: { kind: "primary" },
    updateFrame: () => {},
  };
}
