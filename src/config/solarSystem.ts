import type {
  Mesh,
  PlanetBodyConfig,
  StarBodyConfig,
} from "../app/appPorts.js";
import { AU, km } from "../app/appPorts.js";
import type { KeplerianOrbit } from "../domain/domainPorts.js";
import { vec3, type Vec3 } from "../domain/vec3.js";
import { colors } from "./colors.js";

// Mean distance Earth–Moon in meters
const EARTH_MOON_DISTANCE = 384_400 * km; // m

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
export function buildDefaultSolarSystemConfigs(): (
  | PlanetBodyConfig
  | StarBodyConfig
)[] {
  const sunId = "planet:sun";

  const configs: (PlanetBodyConfig | StarBodyConfig)[] = [
    {
      id: sunId,
      kind: "star",
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
      centralBodyId: sunId,
      color: colors.sun,
      mesh: cloneAndScalePrototype(radii.sun),
      luminosity: luminosities.sun,
      obliquityRad: degToRad(obliquitiesDeg.sun),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.sun),
    },
    {
      id: "planet:mercury",
      pathId: "path:planet:mercury",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.mercury,
      mesh: cloneAndScalePrototype(radii.mercury),
      obliquityRad: degToRad(obliquitiesDeg.mercury),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mercury),
    },
    {
      id: "planet:venus",
      pathId: "path:planet:venus",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.venus,
      mesh: cloneAndScalePrototype(radii.venus),
      obliquityRad: degToRad(obliquitiesDeg.venus),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.venus),
    },
    {
      id: "planet:earth",
      pathId: "path:planet:earth",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.earth,
      mesh: cloneAndScalePrototype(radii.earth),
      obliquityRad: degToRad(obliquitiesDeg.earth),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.earth),
    },
    {
      id: "planet:mars",
      pathId: "path:planet:mars",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.mars,
      mesh: cloneAndScalePrototype(radii.mars),
      obliquityRad: degToRad(obliquitiesDeg.mars),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mars),
    },
    {
      id: "planet:jupiter",
      pathId: "path:planet:jupiter",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.jupiter,
      mesh: cloneAndScalePrototype(radii.jupiter),
      obliquityRad: degToRad(obliquitiesDeg.jupiter),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.jupiter),
    },
    {
      id: "planet:saturn",
      pathId: "path:planet:saturn",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.saturn,
      mesh: cloneAndScalePrototype(radii.saturn),
      obliquityRad: degToRad(obliquitiesDeg.saturn),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.saturn),
    },
    {
      id: "planet:uranus",
      pathId: "path:planet:uranus",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.uranus,
      mesh: cloneAndScalePrototype(radii.uranus),
      obliquityRad: degToRad(obliquitiesDeg.uranus),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.uranus),
    },
    {
      id: "planet:neptune",
      pathId: "path:planet:neptune",
      kind: "planet",
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
      centralBodyId: sunId,
      color: colors.neptune,
      mesh: cloneAndScalePrototype(radii.neptune),
      obliquityRad: degToRad(obliquitiesDeg.neptune),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.neptune),
    },
    {
      id: "planet:moon",
      pathId: "path:planet:moon",
      kind: "planet",
      orbit: buildOrbit(
        EARTH_MOON_DISTANCE,
        eccentricities.moon,
        inclinationsDeg.moon,
        lonAscNodeDeg.moon,
        argPeriapsisDeg.moon,
        meanAnomalyAtEpochRad.moon,
      ),
      physicalRadius: radii.moon,
      density: densities.moon,
      centralBodyId: "planet:earth",
      color: colors.moon,
      mesh: cloneAndScalePrototype(radii.moon),
      obliquityRad: degToRad(obliquitiesDeg.moon),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.moon),
    },
  ];

  return configs;
}

const t = (1 + Math.sqrt(5)) / 2;

const icosahedronModel = {
  points: (() => {
    const raw: Vec3[] = [
      vec3.create(-1, t, 0),
      vec3.create(1, t, 0),
      vec3.create(-1, -t, 0),
      vec3.create(1, -t, 0),

      vec3.create(0, -1, t),
      vec3.create(0, 1, t),
      vec3.create(0, -1, -t),
      vec3.create(0, 1, -t),

      vec3.create(t, 0, -1),
      vec3.create(t, 0, 1),
      vec3.create(-t, 0, -1),
      vec3.create(-t, 0, 1),
    ];

    // Normalize vertices onto the unit sphere in-place.
    for (let i = 0; i < raw.length; i++) {
      vec3.normalizeInto(raw[i]);
    }
    return raw;
  })(),
  faces: [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],

    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],

    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],

    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ],
};

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
