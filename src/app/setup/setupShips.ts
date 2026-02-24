import type {
  LocalFrame,
  ShipBody,
  Vec3,
  World,
} from "../../domain/domainPorts.js";
import { localFrame } from "../../domain/localFrame.js";
import { mat3 } from "../../domain/mat3.js";
import { circularSpeedAtRadius } from "../../domain/phys.js";
import { vec3 } from "../../domain/vec3.js";
import { colors } from "../appInternals.js";
import type {
  PlanetSceneObject,
  SceneObject,
  ShipSceneObject,
  StarSceneObject,
} from "../appPorts.js";
import { shipModel } from "../models.js";
import { getPlanetPhysicsById } from "../worldLookup.js";
import { createPolylineSceneObject, initialFrame } from "./worldSetup.js";

const SHIP_VISUAL_SCALE = 15;

const axisScratch = vec3.zero();

export function createInitialShip(
  id: string,
  homePlanetId: string,
  objects: SceneObject[],
  world: World,
): ShipBody {
  const shipBody: ShipBody = createShipBody(id, homePlanetId, objects, world);

  world.shipBodies.push(shipBody);

  const sceneObject: ShipSceneObject = {
    id: shipBody.id,
    kind: "ship",
    mesh: shipModel,
    position: shipBody.position, // alias
    orientation: shipBody.orientation, // alias
    scale: SHIP_VISUAL_SCALE,
    color: colors.ship,
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
    backFaceCulling: false,
  };

  objects.push(sceneObject);

  const mainShipPath = createPolylineSceneObject(
    "path:ship:main",
    colors.yellow,
  );
  mainShipPath.position = shipBody.position; // alias
  objects.push(mainShipPath);

  return shipBody;
}

function createShipBody(
  id: string,
  homePlanetId: string,
  objects: SceneObject[],
  world: World,
) {
  const planetObj = getPlanetObjectById(objects, homePlanetId);
  const planetPhys = getPlanetPhysicsById(world, homePlanetId);

  const position = computeShipStartPosFromPlanet(
    planetObj.position,
    planetObj.physicalRadius,
  );

  const velocity = computeOrbitVelocity(
    position,
    planetObj.position,
    planetObj.velocity,
    planetPhys.mass,
  );

  const frame: LocalFrame = getFrameFromVelocity(velocity);
  const orientation = localFrame.intoMat3(mat3.zero(), frame);

  const shipBody: ShipBody = {
    id,
    frame,
    orientation,
    position,
    velocity,
  };

  return shipBody;
}

function getFrameFromVelocity(velocity: Vec3): LocalFrame {
  const speed = vec3.length(velocity);
  if (speed === 0) {
    return localFrame.clone(initialFrame);
  }

  const targetForward = vec3.normalizeInto(vec3.clone(velocity));

  // Start from the canonical initialFrame
  const baseForward = initialFrame.forward;

  // Compute rotation axis = baseForward × targetForward
  const axis = vec3.crossInto(axisScratch, baseForward, targetForward);
  const axisLen = vec3.length(axis);

  if (axisLen < 1e-6) {
    // Vectors are parallel or anti-parallel.
    const dot = vec3.dot(baseForward, targetForward);
    if (dot > 0.999999) {
      // Same direction: no change needed.
      return localFrame.clone(initialFrame);
    }
    // Opposite direction: rotate 180° around "up" to flip forward.
    return {
      right: vec3.scaleInto(vec3.zero(), -1, initialFrame.right),
      forward: vec3.scaleInto(vec3.zero(), -1, baseForward),
      up: vec3.clone(initialFrame.up),
    };
  }

  // General case: rotate base frame so its forward matches targetForward.
  const axisN = vec3.normalizeInto(axis);
  const dot = Math.min(1, Math.max(-1, vec3.dot(baseForward, targetForward)));
  const angle = Math.acos(dot);

  const frame = localFrame.clone(initialFrame);
  localFrame.rotateAroundAxisInPlace(frame, axisN, angle);

  return frame;
}

function computeShipStartPosFromPlanet(
  planetPosition: Vec3,
  planetRadius: number,
): Vec3 {
  // North pole direction: global +Z in this setup
  const north: Vec3 = vec3.create(0, 0, 1);

  // Use planet's physical radius from its scene object
  const offset = vec3.scaleInto(
    vec3.zero(),
    planetRadius + PLANE_START_ALTITUDE_M,
    north,
  );

  return vec3.addInto(vec3.zero(), planetPosition, offset);
}

// 100 km above Earth's north pole
const PLANE_START_ALTITUDE_M = 10000000; // meters

/**
 * Compute an initial heliocentric velocity for the ship that corresponds
 * to a near-circular orbit around Earth at the given start position.
 *
 * The result is:
 *   v_ship = v_earth + v_rel
 *
 * where v_rel is perpendicular to the Earth→ship radial direction and
 * has the circular speed for an orbit around Earth's mass at that radius.
 */
function computeOrbitVelocity(
  objectPosition: Vec3,
  planetPosition: Vec3,
  planetVelocity: Vec3,
  planetMass: number,
): Vec3 {
  // Planet's heliocentric velocity: dominant motion
  const vPlanet = vec3.clone(planetVelocity);

  // Radial offset planet -> object
  const earthCenter = planetPosition;
  const offset = vec3.subInto(vec3.zero(), objectPosition, earthCenter);
  const r = vec3.length(offset);
  if (r === 0) {
    // Fallback: just use the planet's velocity
    return vPlanet;
  }

  const radialDir = vec3.scaleInto(offset, 1 / r, offset);

  // Build a tangential direction around planet, perpendicular to radialDir.
  // Use planet's current orbital direction as a reference, projected to be orthogonal.
  const planetDir = vec3.normalizeInto(vec3.clone(vPlanet));
  const dot = vec3.dot(planetDir, radialDir);
  vec3.scaleInto(radialDir, dot, radialDir);
  const tangential = vec3.subInto(radialDir, planetDir, radialDir);
  vec3.normalizeInto(tangential);
  const tangentialDir = vec3.length(tangential) > 0 ? tangential : planetDir;

  // Local circular orbital speed around planet at this radius.
  const vRelMag = circularSpeedAtRadius(planetMass, r);
  const vRel = vec3.scaleInto(tangentialDir, vRelMag, tangentialDir);

  // Total: planet's heliocentric velocity + local orbital component.
  return vec3.addInto(vRel, vPlanet, vRel);
}

function getPlanetObjectById(
  array: SceneObject[],
  id: string,
): PlanetSceneObject | StarSceneObject {
  const obj = array.find(
    (o): o is PlanetSceneObject | StarSceneObject =>
      o.id === id && (o.kind === "planet" || o.kind === "star"),
  );

  if (!obj) {
    throw new Error(`Planet or star object not found: ${id}`);
  }

  return obj;
}
