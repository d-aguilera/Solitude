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

function createShip(id: string): ControlledBody {
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
    const star = createState("body:star");
    const planet = createState("body:planet");
    const ship = createShip("craft:main");
    const entities: EntityConfig[] = [
      {
        id: star.id,
        metadata: { legacyKind: "star" },
        components: {
          lightEmitter: { luminosity: 99 },
          renderable: { color: { r: 1, g: 1, b: 0 }, mesh },
          state: {
            centralBodyId: star.id,
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
        id: planet.id,
        metadata: { legacyKind: "planet" },
        components: {
          renderable: { color: { r: 0, g: 0, b: 1 }, mesh },
          state: {
            centralBodyId: star.id,
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
        id: ship.id,
        metadata: { legacyKind: "ship" },
        components: {
          controllable: { enabled: true },
          renderable: { color: { r: 1, g: 1, b: 1 }, mesh },
        },
      },
    ];
    const world: World = {
      axialSpins: [],
      collisionSpheres: [],
      controllableBodies: [ship],
      entities: entities.map((entity) => ({ id: entity.id })),
      entityIndex: new Map(
        entities.map((entity) => [entity.id, { id: entity.id }]),
      ),
      entityStates: [star, planet, ship],
      gravityMasses: [],
      lightEmitters: [{ id: star.id, luminosity: 99, state: star }],
    };
    const config: WorldAndSceneConfig = {
      entities,
      mainFocusEntityId: ship.id,
      render: {
        mainViewCameraOffset: vec3.zero(),
        mainViewLookState: { azimuth: 0, elevation: 0 },
      },
      thrustLevel: 1,
    };

    const { scene } = createScene(world, config);

    expect(scene.objects.map((object) => object.kind)).toEqual([
      "star",
      "planet",
      "ship",
    ]);
    expect(scene.objects.map((object) => object.id)).toEqual([
      star.id,
      planet.id,
      ship.id,
    ]);
    expect(scene.lights).toEqual([{ position: star.position, intensity: 99 }]);
    expect(scene.objects[0].position).toBe(star.position);
    expect(scene.objects[2].position).toBe(ship.position);
  });
});
