import { describe, expect, it } from "vitest";
import type { EntityConfig, WorldAndSceneConfig } from "../../app/configPorts";
import type { Mesh } from "../../app/scenePorts";
import type {
  ControlledBody,
  EntityMotionState,
  World,
} from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { createScene } from "../../setup/sceneSetup";

const mesh: Mesh = {
  faces: [],
  points: [],
};

function createState(id: string): EntityMotionState {
  return {
    id,
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createControlledBody(id: string): ControlledBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(1, 0, 0),
    velocity: vec3.zero(),
  };
}

describe("createScene", () => {
  it("creates scene objects and lights from generic entity capabilities", () => {
    const lightEmitter = createState("body:light");
    const orbitalBody = createState("body:orbital");
    const controlledBody = createControlledBody("craft:main");
    const entities: EntityConfig[] = [
      {
        id: lightEmitter.id,
        components: {
          lightEmitter: { luminosity: 99 },
          renderable: {
            color: { r: 1, g: 1, b: 0 },
            mesh,
            role: "lightEmitter",
          },
          state: {
            centralEntityId: lightEmitter.id,
            kind: "keplerian",
            orbit: {
              argPeriapsisRad: 0,
              eccentricity: 0,
              inclinationRad: 0,
              lonAscNodeRad: 0,
              meanAnomalyAtEpochRad: 0,
              semiMajorAxis: 0,
            },
          },
        },
      },
      {
        id: orbitalBody.id,
        components: {
          renderable: {
            color: { r: 0, g: 0, b: 1 },
            mesh,
            role: "orbitalBody",
          },
          state: {
            centralEntityId: lightEmitter.id,
            kind: "keplerian",
            orbit: {
              argPeriapsisRad: 0,
              eccentricity: 0,
              inclinationRad: 0,
              lonAscNodeRad: 0,
              meanAnomalyAtEpochRad: 0,
              semiMajorAxis: 1,
            },
          },
        },
      },
      {
        id: controlledBody.id,
        components: {
          controllable: { enabled: true },
          renderable: {
            color: { r: 1, g: 1, b: 1 },
            mesh,
            role: "controlledBody",
          },
        },
      },
    ];
    const world: World = {
      axialSpins: [],
      collisionSpheres: [],
      controllableBodies: [controlledBody],
      entities: entities.map((entity) => ({ id: entity.id })),
      entityIndex: new Map(
        entities.map((entity) => [entity.id, { id: entity.id }]),
      ),
      entityStates: [lightEmitter, orbitalBody, controlledBody],
      gravityMasses: [],
      lightEmitters: [
        { id: lightEmitter.id, luminosity: 99, state: lightEmitter },
      ],
    };
    const config: WorldAndSceneConfig = {
      entities,
      mainFocusEntityId: controlledBody.id,
      render: {
        mainViewCameraOffset: vec3.zero(),
        mainViewLookState: { azimuth: 0, elevation: 0 },
      },
    };

    const { scene } = createScene(world, config);

    expect(scene.objects.map((object) => object.kind)).toEqual([
      "lightEmitter",
      "orbitalBody",
      "controlledBody",
    ]);
    expect(scene.objects.map((object) => object.id)).toEqual([
      lightEmitter.id,
      orbitalBody.id,
      controlledBody.id,
    ]);
    expect(scene.lights).toEqual([
      { position: lightEmitter.position, intensity: 99 },
    ]);
    expect(scene.objects[0].position).toBe(lightEmitter.position);
    expect(scene.objects[2].position).toBe(controlledBody.position);
  });
});
