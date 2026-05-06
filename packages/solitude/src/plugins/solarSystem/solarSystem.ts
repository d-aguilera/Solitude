import type {
  EntityRenderConfig,
  KeplerianBodyPhysicsConfig,
  KeplerianOrbit,
} from "@solitude/engine/app/configPorts";
import type { Mesh } from "@solitude/engine/app/scenePorts";
import { parseObjMesh } from "@solitude/engine/config/obj";
import { AU, km } from "@solitude/engine/domain/units";
import { vec3, type Vec3 } from "@solitude/engine/domain/vec3";
import { colors } from "./colors";
import icoObjText from "./ico.obj?raw";

// --- Generated from JPL Horizons at epoch J2000.0 ---

// Real(ish) semi‑major axes (meters)
const orbits = {
  mercury: 0.387098212184 * AU,
  venus: 0.72332692748 * AU,
  earth: 1.000448828934 * AU,
  mars: 1.523678992939 * AU,
  jupiter: 5.204336211826 * AU,
  saturn: 9.581929200479 * AU,
  uranus: 19.230147659151 * AU,
  neptune: 30.093922090027 * AU,
  moon: 384_400 * km, // relative to Earth
  phobos: 9_376 * km, // relative to Mars
  deimos: 23_463 * km, // relative to Mars
};

// Approximate orbital eccentricities (dimensionless)
const eccentricities = {
  mercury: 0.20563029,
  venus: 0.00675579,
  earth: 0.01711863,
  mars: 0.0933151,
  jupiter: 0.04878759,
  saturn: 0.05563834,
  uranus: 0.04439277,
  neptune: 0.01120359,
  moon: 0.0549,
  phobos: 0.0151,
  deimos: 0.00033,
};

// Real planetary mean radii (meters)
const radii = {
  sun: 696_340 * km,
  mercury: 2_439.7 * km,
  venus: 6_051.8 * km,
  earth: 6_371.0 * km,
  mars: 3_389.5 * km,
  jupiter: 69_911 * km,
  saturn: 58_232 * km,
  uranus: 25_362 * km,
  neptune: 24_622 * km,
  moon: 1_737.4 * km,
  phobos: 11_266, // ~11 km effective radius
  deimos: 6_200, // ~6 km effective radius
};

// Approximate mean densities (kg/m^3)
const densities = {
  sun: 1_408,
  mercury: 5_427,
  venus: 5_243,
  earth: 5_514,
  mars: 3_933,
  jupiter: 1_326,
  saturn: 687,
  uranus: 1_270,
  neptune: 1_638,
  moon: 3_344,
  phobos: 1_900,
  deimos: 1_500,
};

// Bolometric luminosities (W)
const luminosities = {
  sun: 3.828e26,
};

// Approximate sidereal rotation periods in seconds (sign encodes direction).
const spinPeriodsSeconds = {
  sun: 25.05 * 24 * 3600,
  mercury: 58.6 * 24 * 3600,
  venus: -243 * 24 * 3600, // retrograde
  earth: 23.934 * 3600,
  mars: 24.6 * 3600,
  jupiter: 9.93 * 3600,
  saturn: 10.7 * 3600,
  uranus: -17.2 * 3600, // retrograde
  neptune: 16.1 * 3600,
  moon: 27.321661 * 24 * 3600,
  phobos: 7.66 * 3600, // tidally locked, ~7.66h orbit/spin
  deimos: 30.35 * 3600, // ~30.35h
};

// Axial tilts (obliquity) in degrees, relative to each planet's orbital normal.
const obliquitiesDeg = {
  sun: 7.25,
  mercury: 0.03,
  venus: 177.4, // almost upside down, retrograde
  earth: 23.44,
  mars: 25.19,
  jupiter: 3.13,
  saturn: 26.73,
  uranus: 97.77, // nearly on its side
  neptune: 28.32,
  moon: 6.68,
  phobos: 0, // approximate
  deimos: 0, // approximate
};

/**
 * Approximate orbital inclinations (degrees) relative to a reference plane.
 * Here we treat the ecliptic as the reference, and interpret these angles
 * as inclination of each orbital plane relative to the global +Z axis.
 */
const inclinationsDeg = {
  mercury: 7.0050143,
  venus: 3.39458965,
  earth: 0.00041811,
  mars: 1.84987648,
  jupiter: 1.30463059,
  saturn: 2.48425239,
  uranus: 0.77267578,
  neptune: 1.77021406,
  moon: 5.145, // relative to ecliptic
  phobos: 1.1, // ~1° to Mars equator; we approximate against ecliptic
  deimos: 1.8,
};

/**
 * Approximate longitudes of ascending node (degrees).
 *
 * These angles, together with inclinations and arguments of periapsis,
 * define the full 3D orientation of each Keplerian orbit.
 *
 * Values used here are rough and not tied to a particular epoch; they are
 * intended to produce visually plausible relative orientations.
 */
const lonAscNodeDeg = {
  mercury: 48.33053855,
  venus: 76.67837412,
  earth: 135.08071826,
  mars: 49.56200566,
  jupiter: 100.49114995,
  saturn: 113.69966003,
  uranus: 74.00474643,
  neptune: 131.78387711,
  moon: 125.08,
  phobos: 45.0,
  deimos: 60.0,
};

/**
 * Approximate arguments of periapsis (degrees).
 */
const argPeriapsisDeg = {
  mercury: 29.12428166,
  venus: 55.18596703,
  earth: 326.72821886,
  mars: 286.53738309,
  jupiter: 275.06906661,
  saturn: 335.86559372,
  uranus: 96.5887248,
  neptune: 267.31580198,
  moon: 318.15,
  phobos: 150.0,
  deimos: 250.0,
};

// mean anomaly at J2000, in radians
const meanAnomalyAtEpochRad = {
  mercury: 3.050763675831,
  venus: 0.874667773088,
  earth: 6.259051875885,
  mars: 0.337834355546,
  jupiter: 0.328394643849,
  saturn: 5.592480981712,
  uranus: 2.493893561901,
  neptune: 4.64440886758,
  moon: 2.5,
  phobos: 1.0,
  deimos: 3.5,
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function angularSpeedFromPeriod(periodSeconds: number): number {
  if (periodSeconds === 0) return 0;
  return (2 * Math.PI) / periodSeconds;
}

/**
 * Helper to build a simple KeplerianOrbit for an orbit relative to a central body.
 *
 * meanAnomalyAtEpochRad is chosen to distribute bodies around their primary
 * without targeting a specific historical epoch.
 */
function buildOrbit(
  semiMajorAxis: number,
  eccentricity: number,
  inclinationDeg: number,
  lonAscNodeDegVal: number,
  argPeriapsisDegVal: number,
  meanAnomalyAtEpochRad: number,
): KeplerianOrbit {
  return {
    semiMajorAxis,
    eccentricity,
    inclinationRad: degToRad(inclinationDeg),
    lonAscNodeRad: degToRad(lonAscNodeDegVal),
    argPeriapsisRad: degToRad(argPeriapsisDegVal),
    meanAnomalyAtEpochRad,
  };
}

/**
 * Build a simplified solar system.
 *
 * - Sizes are roughly proportional to real radii.
 * - Densities and masses are near-realistic for each body class.
 * - Initial positions and velocities are derived from Keplerian orbital
 *   elements relative to each body's central mass.
 *
 * All distances and radii are in meters.
 */
type SolarBodyConfig = KeplerianBodyPhysicsConfig & EntityRenderConfig;

export function buildDefaultSolarSystemConfigs(): {
  physics: KeplerianBodyPhysicsConfig[];
  render: EntityRenderConfig[];
} {
  const sunId = "planet:sun";

  const configs: SolarBodyConfig[] = [
    {
      id: sunId,
      orbit: {
        semiMajorAxis: 0,
        eccentricity: 0,
        inclinationRad: 0,
        lonAscNodeRad: 0,
        argPeriapsisRad: 0,
        meanAnomalyAtEpochRad: 0,
      },
      physicalRadius: radii.sun,
      density: densities.sun,
      centralEntityId: sunId,
      color: colors.sun,
      mesh: cloneAndScalePrototype(radii.sun),
      luminosity: luminosities.sun,
      obliquityRad: degToRad(obliquitiesDeg.sun),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.sun),
    },
    {
      id: "planet:mercury",
      orbit: buildOrbit(
        orbits.mercury,
        eccentricities.mercury,
        inclinationsDeg.mercury,
        lonAscNodeDeg.mercury,
        argPeriapsisDeg.mercury,
        meanAnomalyAtEpochRad.mercury,
      ),
      physicalRadius: radii.mercury,
      density: densities.mercury,
      centralEntityId: sunId,
      color: colors.mercury,
      mesh: cloneAndScalePrototype(radii.mercury),
      obliquityRad: degToRad(obliquitiesDeg.mercury),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mercury),
    },
    {
      id: "planet:venus",
      orbit: buildOrbit(
        orbits.venus,
        eccentricities.venus,
        inclinationsDeg.venus,
        lonAscNodeDeg.venus,
        argPeriapsisDeg.venus,
        meanAnomalyAtEpochRad.venus,
      ),
      physicalRadius: radii.venus,
      density: densities.venus,
      centralEntityId: sunId,
      color: colors.venus,
      mesh: cloneAndScalePrototype(radii.venus),
      obliquityRad: degToRad(obliquitiesDeg.venus),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.venus),
    },
    {
      id: "planet:earth",
      orbit: buildOrbit(
        orbits.earth,
        eccentricities.earth,
        inclinationsDeg.earth,
        lonAscNodeDeg.earth,
        argPeriapsisDeg.earth,
        meanAnomalyAtEpochRad.earth,
      ),
      physicalRadius: radii.earth,
      density: densities.earth,
      centralEntityId: sunId,
      color: colors.earth,
      mesh: cloneAndScalePrototype(radii.earth),
      obliquityRad: degToRad(obliquitiesDeg.earth),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.earth),
    },
    {
      id: "planet:mars",
      orbit: buildOrbit(
        orbits.mars,
        eccentricities.mars,
        inclinationsDeg.mars,
        lonAscNodeDeg.mars,
        argPeriapsisDeg.mars,
        meanAnomalyAtEpochRad.mars,
      ),
      physicalRadius: radii.mars,
      density: densities.mars,
      centralEntityId: sunId,
      color: colors.mars,
      mesh: cloneAndScalePrototype(radii.mars),
      obliquityRad: degToRad(obliquitiesDeg.mars),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mars),
    },
    {
      id: "planet:jupiter",
      orbit: buildOrbit(
        orbits.jupiter,
        eccentricities.jupiter,
        inclinationsDeg.jupiter,
        lonAscNodeDeg.jupiter,
        argPeriapsisDeg.jupiter,
        meanAnomalyAtEpochRad.jupiter,
      ),
      physicalRadius: radii.jupiter,
      density: densities.jupiter,
      centralEntityId: sunId,
      color: colors.jupiter,
      mesh: cloneAndScalePrototype(radii.jupiter),
      obliquityRad: degToRad(obliquitiesDeg.jupiter),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.jupiter),
    },
    {
      id: "planet:saturn",
      orbit: buildOrbit(
        orbits.saturn,
        eccentricities.saturn,
        inclinationsDeg.saturn,
        lonAscNodeDeg.saturn,
        argPeriapsisDeg.saturn,
        meanAnomalyAtEpochRad.saturn,
      ),
      physicalRadius: radii.saturn,
      density: densities.saturn,
      centralEntityId: sunId,
      color: colors.saturn,
      mesh: cloneAndScalePrototype(radii.saturn),
      obliquityRad: degToRad(obliquitiesDeg.saturn),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.saturn),
    },
    {
      id: "planet:uranus",
      orbit: buildOrbit(
        orbits.uranus,
        eccentricities.uranus,
        inclinationsDeg.uranus,
        lonAscNodeDeg.uranus,
        argPeriapsisDeg.uranus,
        meanAnomalyAtEpochRad.uranus,
      ),
      physicalRadius: radii.uranus,
      density: densities.uranus,
      centralEntityId: sunId,
      color: colors.uranus,
      mesh: cloneAndScalePrototype(radii.uranus),
      obliquityRad: degToRad(obliquitiesDeg.uranus),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.uranus),
    },
    {
      id: "planet:neptune",
      orbit: buildOrbit(
        orbits.neptune,
        eccentricities.neptune,
        inclinationsDeg.neptune,
        lonAscNodeDeg.neptune,
        argPeriapsisDeg.neptune,
        meanAnomalyAtEpochRad.neptune,
      ),
      physicalRadius: radii.neptune,
      density: densities.neptune,
      centralEntityId: sunId,
      color: colors.neptune,
      mesh: cloneAndScalePrototype(radii.neptune),
      obliquityRad: degToRad(obliquitiesDeg.neptune),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.neptune),
    },
    {
      id: "planet:moon",
      orbit: buildOrbit(
        orbits.moon,
        eccentricities.moon,
        inclinationsDeg.moon,
        lonAscNodeDeg.moon,
        argPeriapsisDeg.moon,
        meanAnomalyAtEpochRad.moon,
      ),
      physicalRadius: radii.moon,
      density: densities.moon,
      centralEntityId: "planet:earth",
      color: colors.moon,
      mesh: cloneAndScalePrototype(radii.moon),
      obliquityRad: degToRad(obliquitiesDeg.moon),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.moon),
    },
    {
      id: "planet:phobos",
      orbit: buildOrbit(
        orbits.phobos,
        eccentricities.phobos,
        inclinationsDeg.phobos,
        lonAscNodeDeg.phobos,
        argPeriapsisDeg.phobos,
        meanAnomalyAtEpochRad.phobos,
      ),
      physicalRadius: radii.phobos,
      density: densities.phobos,
      centralEntityId: "planet:mars",
      color: colors.phobos,
      mesh: cloneAndScalePrototype(radii.phobos),
      obliquityRad: degToRad(obliquitiesDeg.phobos),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.phobos),
    },
    {
      id: "planet:deimos",
      orbit: buildOrbit(
        orbits.deimos,
        eccentricities.deimos,
        inclinationsDeg.deimos,
        lonAscNodeDeg.deimos,
        argPeriapsisDeg.deimos,
        meanAnomalyAtEpochRad.deimos,
      ),
      physicalRadius: radii.deimos,
      density: densities.deimos,
      centralEntityId: "planet:mars",
      color: colors.deimos,
      mesh: cloneAndScalePrototype(radii.deimos),
      obliquityRad: degToRad(obliquitiesDeg.deimos),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.deimos),
    },
  ];

  const physics: KeplerianBodyPhysicsConfig[] = [];
  const render: EntityRenderConfig[] = [];

  for (const cfg of configs) {
    physics.push({
      id: cfg.id,
      orbit: cfg.orbit,
      physicalRadius: cfg.physicalRadius,
      density: cfg.density,
      centralEntityId: cfg.centralEntityId,
      obliquityRad: cfg.obliquityRad,
      angularSpeedRadPerSec: cfg.angularSpeedRadPerSec,
      luminosity: cfg.luminosity,
    });

    render.push({
      id: cfg.id,
      centralEntityId: cfg.centralEntityId,
      color: cfg.color,
      mesh: cfg.mesh,
    });
  }

  return { physics, render };
}

const icosahedronModel = parseObjMesh(icoObjText);

const planetPrototype: Mesh = generatePlanetMesh();

function cloneAndScalePrototype(radius: number): Mesh {
  const points = planetPrototype.points.map(vec3.clone);
  const clone: Mesh = {
    faces: planetPrototype.faces, // safe to alias here
    points,
    faceNormals: planetPrototype.faceNormals?.map(vec3.clone),
  };
  for (let p of points) {
    vec3.scaleInto(p, radius, p);
  }
  return clone;
}

function generatePlanetMesh(subdivisions = 3): Mesh {
  // Single reusable scratch vector for midpoint computation.
  const midpointScratch: Vec3 = vec3.zero();

  const getMidpointIndex = (i1: number, i2: number): number => {
    const cacheKey = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    let idx = midpointCache[cacheKey];
    if (idx === undefined) {
      // Compute the midpoint on the unit sphere between vertices[i1] and vertices[i2]
      const v1 = vertices[i1];
      const v2 = vertices[i2];

      // midpointScratch = v1 + v2
      vec3.addInto(midpointScratch, v1, v2);
      const v = vec3.normalizeInto(midpointScratch);

      idx = vertices.push(vec3.create(v.x, v.y, v.z)) - 1;
      midpointCache[cacheKey] = idx;
    }
    return idx;
  };

  // Start from a deep clone of the base icosahedron mesh
  let vertices: Vec3[] = icosahedronModel.points.map(vec3.clone);
  let faces: number[][] = icosahedronModel.faces.map((f) => [...f]);
  let midpointCache: { [key: string]: number } = {};

  for (let s = 0; s < subdivisions; s++) {
    const newFaces: number[][] = [];
    for (const [a, b, c] of faces) {
      // split each side of the triangle in 2 halfs
      const ab = getMidpointIndex(a, b);
      const bc = getMidpointIndex(b, c);
      const ca = getMidpointIndex(c, a);
      // and create 4 smaller triangles
      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }

    midpointCache = {};
    faces = newFaces;
  }

  const points: Vec3[] = vertices.map(vec3.clone);
  const faceNormals: Vec3[] = new Array(faces.length);

  // Reusable scratch vectors for face normal computation.
  const e1Scratch: Vec3 = vec3.zero();
  const e2Scratch: Vec3 = vec3.zero();
  const normalScratch: Vec3 = vec3.zero();

  const getFaceNormal = (face: number[]): Vec3 => {
    const v0 = points[face[0]];
    const v1 = points[face[1]];
    const v2 = points[face[2]];

    // e1 = v1 - v0
    vec3.subInto(e1Scratch, v1, v0);
    // e2 = v2 - v0
    vec3.subInto(e2Scratch, v2, v0);
    // normalScratch = e1 × e2
    vec3.crossInto(normalScratch, e1Scratch, e2Scratch);

    return normalScratch;
  };

  // Ensure face normals point outward from the origin (unit sphere)
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    let n = getFaceNormal(face);
    if (vec3.dot(n, points[face[0]]) < 0) {
      // if not, flip winding
      const aux = face[1];
      face[1] = face[2];
      face[2] = aux;
      n = getFaceNormal(face);
    }

    // Store a normalized copy for this face using a reusable scratch.
    faceNormals[i] = vec3.clone(vec3.normalizeInto(n));
  }

  return {
    points,
    faces,
    faceNormals,
  };
}
