import type { ShipPhysicsConfig } from "../app/configPorts";
import type { ShipBody, ShipPhysics, World } from "../domain/domainPorts";
import { DOT_PARALLEL_COS, EPS_LEN, EPS_LEN_STRICT } from "../domain/epsilon";
import { localFrame, type LocalFrame } from "../domain/localFrame";
import { mat3 } from "../domain/mat3";
import { circularSpeedAtRadius } from "../domain/phys";
import { vec3, type Vec3 } from "../domain/vec3";
import { initialFrame } from "./setup";

const axisScratch = vec3.zero();

export function addShipsFromConfig(configs: ShipPhysicsConfig[], world: World) {
  for (let config of configs) {
    const { shipBody, shipPhysics } = createShip(config, world);
    world.ships.push(shipBody);
    world.shipPhysics.push(shipPhysics);
  }
}

function createShip(
  { altitude, homePlanetId, id, density, volume }: ShipPhysicsConfig,
  world: World,
): { shipBody: ShipBody; shipPhysics: ShipPhysics } {
  const planetIndex = world.planets.findIndex(
    (planet) => planet.id === homePlanetId,
  );
  if (planetIndex < 0) {
    throw new Error(`Planet not found: ${homePlanetId}`);
  }
  const planetObj = world.planets[planetIndex];
  const planetPhys = world.planetPhysics[planetIndex];
  const shipPhysics: ShipPhysics = {
    id,
    density,
    mass: density * volume,
  };

  const position = computeShipStartPosFromPlanet(
    planetObj.position,
    planetPhys.physicalRadius,
    altitude,
  );

  const velocity = computeOrbitVelocity(
    position,
    planetObj.position,
    planetObj.velocity,
    planetPhys.mass,
    shipPhysics.mass,
  );

  const frame: LocalFrame = getFrameFromVelocity(velocity);
  const orientation = localFrame.intoMat3(mat3.zero(), frame);
  const angularVelocity = { roll: 0, pitch: 0, yaw: 0 };

  const shipBody: ShipBody = {
    id,
    frame,
    orientation,
    position,
    velocity,
    angularVelocity,
  };

  return { shipBody, shipPhysics };
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

  if (axisLen < EPS_LEN) {
    // Vectors are parallel or anti-parallel.
    const dot = vec3.dot(baseForward, targetForward);
    if (dot > DOT_PARALLEL_COS) {
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
  altitude: number,
): Vec3 {
  // North pole direction: global +Z in this setup
  const north: Vec3 = vec3.create(0, 0, 1);

  const offset = vec3.scaleInto(vec3.zero(), planetRadius + altitude, north);

  return vec3.addInto(vec3.zero(), planetPosition, offset);
}

/**
 * Compute an initial heliocentric velocity for the ship that corresponds
 * to a near-circular orbit around Earth at the given start position.
 *
 * The result is:
 *   v_ship = v_earth + v_rel
 *
 * where v_rel is perpendicular to the Earth→ship radial direction and
 * has the circular relative-orbit speed for the planet+ship system at that separation.
 */
function computeOrbitVelocity(
  objectPosition: Vec3,
  planetPosition: Vec3,
  planetVelocity: Vec3,
  planetMass: number,
  shipMass: number,
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
  // Prefer projecting the planet's velocity, but fall back to a fixed axis
  // if the planet is nearly stationary or the projection is degenerate.
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

  // Local circular orbital speed around the planet at this separation.
  // In the test-particle approximation, the ship's mass cancels out and this
  // would be circularSpeedAtRadius(planetMass, r). Since our gravity integrator
  // moves *both* bodies, incorporate ship mass for a better 2-body circular
  // relative-orbit approximation.
  const vRelMag = circularSpeedAtRadius(planetMass + shipMass, r);
  const vRel = vec3.scaleInto(tangentialDir, vRelMag, tangentialDir);

  // Total: planet's heliocentric velocity + local orbital component.
  return vec3.addInto(vRel, vPlanet, vRel);
}
