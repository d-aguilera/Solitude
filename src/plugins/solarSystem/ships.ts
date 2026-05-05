import type {
  ControlledBodyInitialStateConfig,
  ControlledBodyPhysicsConfig,
  EntityRenderConfig,
  KeplerianBodyPhysicsConfig,
} from "../../app/configPorts";
import type { Mesh } from "../../app/scenePorts";
import { parseObjMesh } from "../../config/obj";
import type {
  RotatingBody,
  SphericalBodyPhysics,
} from "../../domain/domainPorts";
import {
  DOT_PARALLEL_COS,
  EPS_LEN,
  EPS_LEN_STRICT,
} from "../../domain/epsilon";
import { localFrame, type LocalFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { computeVolumeOfTriangleMesh } from "../../domain/meshVolume";
import { circularSpeedAtRadius } from "../../domain/phys";
import { km } from "../../domain/units";
import { vec3, type Vec3 } from "../../domain/vec3";
import { initialFrame } from "../../setup/setup";
import { createKeplerianBodiesFromConfig } from "../../setup/setupKeplerianBodies";
import { colors } from "./colors";
import shipObjText from "./ship.obj?raw";

const SHIP_DENSITY_KG_PER_M3 = 2700;
const SHIP_START_ALTITUDE_M = 100 * km;
const EARTH_ID = "planet:earth";

const axisScratch = vec3.zero();

export function buildDefaultSolarSystemShipConfigs(
  celestialPhysics: KeplerianBodyPhysicsConfig[],
): {
  initialStates: ControlledBodyInitialStateConfig[];
  physics: ControlledBodyPhysicsConfig[];
  render: EntityRenderConfig[];
} {
  const mainShipMesh = createScaledShipMesh();
  const enemyShipMesh = createScaledShipMesh();
  const mainShipVolume = computeVolumeOfTriangleMesh(
    mainShipMesh.points,
    mainShipMesh.faces,
  );
  const enemyShipVolume = computeVolumeOfTriangleMesh(
    enemyShipMesh.points,
    enemyShipMesh.faces,
  );

  const physics: ControlledBodyPhysicsConfig[] = [
    {
      density: SHIP_DENSITY_KG_PER_M3,
      id: "ship:main",
      volume: mainShipVolume,
    },
    {
      density: SHIP_DENSITY_KG_PER_M3,
      id: "ship:enemy",
      volume: enemyShipVolume,
    },
  ];

  const render: EntityRenderConfig[] = [
    {
      color: colors.ship,
      id: "ship:main",
      mesh: mainShipMesh,
    },
    {
      color: colors.enemyShip,
      id: "ship:enemy",
      mesh: enemyShipMesh,
    },
  ];

  const { earthBody, earthPhysics } = createEarthState(celestialPhysics);
  const initialStates: ControlledBodyInitialStateConfig[] = [
    createOrbitingShipInitialState({
      body: earthBody,
      direction: vec3.create(0, 0, 1),
      id: "ship:main",
      physics: earthPhysics,
      shipMass: SHIP_DENSITY_KG_PER_M3 * mainShipVolume,
    }),
    createOrbitingShipInitialState({
      body: earthBody,
      direction: vec3.create(0, 0, -1),
      id: "ship:enemy",
      physics: earthPhysics,
      shipMass: SHIP_DENSITY_KG_PER_M3 * enemyShipVolume,
    }),
  ];

  return { initialStates, physics, render };
}

function createEarthState(celestialPhysics: KeplerianBodyPhysicsConfig[]): {
  earthBody: RotatingBody;
  earthPhysics: SphericalBodyPhysics;
} {
  const setup = createKeplerianBodiesFromConfig(celestialPhysics);

  const earthIndex = setup.bodies.findIndex((body) => body.id === EARTH_ID);
  if (earthIndex < 0) {
    throw new Error(`Solar system plugin requires body: ${EARTH_ID}`);
  }

  return {
    earthBody: setup.bodies[earthIndex],
    earthPhysics: setup.physics[earthIndex],
  };
}

function createOrbitingShipInitialState({
  body,
  direction,
  id,
  physics,
  shipMass,
}: {
  body: RotatingBody;
  direction: Vec3;
  id: string;
  physics: SphericalBodyPhysics;
  shipMass: number;
}): ControlledBodyInitialStateConfig {
  const radialDirection = vec3.normalizeInto(direction);
  const position = computeShipStartPosition(
    body.position,
    physics.physicalRadius,
    SHIP_START_ALTITUDE_M,
    radialDirection,
  );
  const velocity = computeOrbitVelocity(
    position,
    body.position,
    body.velocity,
    physics.mass,
    shipMass,
  );
  const frame = getFrameFromVelocity(velocity);
  const orientation = localFrame.intoMat3(mat3.zero(), frame);

  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation,
    position,
    velocity,
  };
}

function createScaledShipMesh(): Mesh {
  const points = shipModel.points.map(vec3.clone);
  for (const point of points) {
    vec3.scaleInto(point, 150_000, point);
  }

  return {
    faces: shipModel.faces,
    points,
  };
}

function getFrameFromVelocity(velocity: Vec3): LocalFrame {
  const speed = vec3.length(velocity);
  if (speed === 0) {
    return localFrame.clone(initialFrame);
  }

  const targetForward = vec3.normalizeInto(vec3.clone(velocity));
  const baseForward = initialFrame.forward;
  const axis = vec3.crossInto(axisScratch, baseForward, targetForward);
  const axisLen = vec3.length(axis);

  if (axisLen < EPS_LEN) {
    const dot = vec3.dot(baseForward, targetForward);
    if (dot > DOT_PARALLEL_COS) {
      return localFrame.clone(initialFrame);
    }
    return {
      forward: vec3.scaleInto(vec3.zero(), -1, baseForward),
      right: vec3.scaleInto(vec3.zero(), -1, initialFrame.right),
      up: vec3.clone(initialFrame.up),
    };
  }

  const axisN = vec3.normalizeInto(axis);
  const dot = Math.min(1, Math.max(-1, vec3.dot(baseForward, targetForward)));
  const angle = Math.acos(dot);
  const frame = localFrame.clone(initialFrame);
  localFrame.rotateAroundAxisInPlace(frame, axisN, angle);
  return frame;
}

function computeShipStartPosition(
  planetPosition: Vec3,
  planetRadius: number,
  altitude: number,
  radialDirection: Vec3,
): Vec3 {
  const offset = vec3.scaleInto(
    vec3.zero(),
    planetRadius + altitude,
    radialDirection,
  );

  return vec3.addInto(vec3.zero(), planetPosition, offset);
}

function computeOrbitVelocity(
  objectPosition: Vec3,
  planetPosition: Vec3,
  planetVelocity: Vec3,
  planetMass: number,
  shipMass: number,
): Vec3 {
  const vPlanet = vec3.clone(planetVelocity);
  const offset = vec3.subInto(vec3.zero(), objectPosition, planetPosition);
  const r = vec3.length(offset);
  if (r === 0) {
    return vPlanet;
  }

  const radialDir = vec3.scaleInto(offset, 1 / r, offset);
  let tangentialDir = vec3.zero();
  let hasTangential = false;

  const planetSpeed = vec3.length(vPlanet);
  if (planetSpeed > 0) {
    const planetDir = vec3.scaleInto(vec3.zero(), 1 / planetSpeed, vPlanet);
    const projMag = vec3.dot(planetDir, radialDir);
    const proj = vec3.scaleInto(vec3.zero(), projMag, radialDir);
    const tangential = vec3.subInto(vec3.zero(), planetDir, proj);
    if (vec3.length(tangential) > EPS_LEN_STRICT) {
      vec3.normalizeInto(tangential);
      tangentialDir = tangential;
      hasTangential = true;
    }
  }

  if (!hasTangential) {
    const fallbackAxis =
      Math.abs(radialDir.z) < 0.9 ? vec3.create(0, 0, 1) : vec3.create(1, 0, 0);
    const tangential = vec3.crossInto(vec3.zero(), fallbackAxis, radialDir);
    vec3.normalizeInto(tangential);
    tangentialDir = tangential;
  }

  const vRelMag = circularSpeedAtRadius(planetMass + shipMass, r);
  const vRel = vec3.scaleInto(tangentialDir, vRelMag, tangentialDir);
  return vec3.addInto(vRel, vPlanet, vRel);
}

const shipModel = parseObjMesh(shipObjText);
