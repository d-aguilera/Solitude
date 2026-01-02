// A small "moon-sized" planet so curvature is visible at typical altitudes.
export const PLANET_RADIUS = 1000; // meters
export const planetCenter = { x: 0, y: 0, z: 0 };

// --- Vector helpers (simple and local; you can move to math.js later) ---

export function vecAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vecSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vecScale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vecDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vecCross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vecLength(v) {
  return Math.hypot(v.x, v.y, v.z);
}

export function vecNormalize(v) {
  const len = vecLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// --- Planet projection helpers ---

// Project an arbitrary point to the planet surface (radius PLANET_RADIUS)
export function projectToSurface(worldPos) {
  const fromCenter = vecSub(worldPos, planetCenter);
  const len = vecLength(fromCenter);
  if (len === 0) {
    // Arbitrary: pick "north pole"
    return { x: 0, y: 0, z: PLANET_RADIUS };
  }
  const scale = PLANET_RADIUS / len;
  return vecAdd(planetCenter, vecScale(fromCenter, scale));
}

// Given a point above the planet, compute altitude above surface
export function altitudeAboveSurface(worldPos) {
  const fromCenter = vecSub(worldPos, planetCenter);
  const len = vecLength(fromCenter);
  return len - PLANET_RADIUS;
}

// Given up vector (from center to surface point), build an orthonormal frame:
// right, forward, up, where forward is some deterministic tangent direction.
export function makeLocalFrame(up) {
  const u = vecNormalize(up);

  // Pick some arbitrary "worldForward" that is not collinear with up
  const worldForward =
    Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

  // Project worldForward onto tangent plane to get initial forward
  const dot = vecDot(u, worldForward);
  let forward = vecSub(worldForward, vecScale(u, dot));
  forward = vecNormalize(forward);

  // right = forward × up
  let right = vecCross(forward, u);
  right = vecNormalize(right);

  // Re-orthogonalize forward = up × right
  forward = vecCross(u, right);

  return { right, forward, up: u };
}

// Generate a latitude circle (constant "latitude" angle), returning a model
// with points on the sphere and line indices forming a loop.
// latAngle in radians: 0 = equator, +π/2 = north pole, -π/2 = south pole.
export function generateLatitudeCircle(latAngle, segments = 64) {
  const points = [];
  const lines = [];
  const r = PLANET_RADIUS;
  const cosLat = Math.cos(latAngle);
  const sinLat = Math.sin(latAngle);

  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const cosLon = Math.cos(t);
    const sinLon = Math.sin(t);

    // Spherical to Cartesian:
    // x = r * cos(lat) * cos(lon)
    // y = r * cos(lat) * sin(lon)
    // z = r * sin(lat)
    points.push({
      x: planetCenter.x + r * cosLat * cosLon,
      y: planetCenter.y + r * cosLat * sinLon,
      z: planetCenter.z + r * sinLat,
    });
  }

  // Single polyline loop
  const indices = [];
  for (let i = 0; i < segments; i++) {
    indices.push(i);
  }
  // close loop by repeating first index
  indices.push(0);
  lines.push(indices);

  return {
    points,
    lines,
    color: { r: 0, g: 200, b: 0 }, // green-ish
    lineWidth: 1,
  };
}

// Generate a longitude circle (constant longitude), full great circle
// lonAngle in radians, 0..2π
export function generateLongitudeCircle(lonAngle, segments = 64) {
  const points = [];
  const lines = [];
  const r = PLANET_RADIUS;
  const cosLon = Math.cos(lonAngle);
  const sinLon = Math.sin(lonAngle);

  for (let i = 0; i <= segments; i++) {
    const t = -Math.PI / 2 + (i / segments) * Math.PI; // from south to north
    const cosLat = Math.cos(t);
    const sinLat = Math.sin(t);

    points.push({
      x: planetCenter.x + r * cosLat * cosLon,
      y: planetCenter.y + r * cosLat * sinLon,
      z: planetCenter.z + r * sinLat,
    });
  }

  const indices = [];
  for (let i = 0; i <= segments; i++) {
    indices.push(i);
  }
  lines.push(indices);

  return {
    points,
    lines,
    color: { r: 0, g: 120, b: 200 }, // blue-ish
    lineWidth: 1,
  };
}

export function generateIcosahedronSphere(subdivisions = 3) {
  const t = (1 + Math.sqrt(5)) / 2;

  // Base icosahedron vertices (unit-ish)
  let vertices = [
    { x: -1, y: t, z: 0 },
    { x: 1, y: t, z: 0 },
    { x: -1, y: -t, z: 0 },
    { x: 1, y: -t, z: 0 },

    { x: 0, y: -1, z: t },
    { x: 0, y: 1, z: t },
    { x: 0, y: -1, z: -t },
    { x: 0, y: 1, z: -t },

    { x: t, y: 0, z: -1 },
    { x: t, y: 0, z: 1 },
    { x: -t, y: 0, z: -1 },
    { x: -t, y: 0, z: 1 },
  ];

  // Normalize to unit sphere first
  vertices = vertices.map(vecNormalize);

  // Base icosahedron faces (20 triangles)
  let faces = [
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
  ];

  // Subdivide
  for (let s = 0; s < subdivisions; s++) {
    const newFaces = [];
    const midpointCache = new Map();

    const getMidpointIndex = (i1, i2) => {
      const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
      if (midpointCache.has(key)) return midpointCache.get(key);

      const v1 = vertices[i1];
      const v2 = vertices[i2];
      const mid = vecNormalize({
        x: (v1.x + v2.x) * 0.5,
        y: (v1.y + v2.y) * 0.5,
        z: (v1.z + v2.z) * 0.5,
      });

      const idx = vertices.length;
      vertices.push(mid);
      midpointCache.set(key, idx);
      return idx;
    };

    for (const [a, b, c] of faces) {
      const ab = getMidpointIndex(a, b);
      const bc = getMidpointIndex(b, c);
      const ca = getMidpointIndex(c, a);

      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }
    faces = newFaces;
  }

  // Scale vertices to planet radius, add planetCenter
  const points = vertices.map((v) => ({
    x: planetCenter.x + v.x * PLANET_RADIUS,
    y: planetCenter.y + v.y * PLANET_RADIUS,
    z: planetCenter.z + v.z * PLANET_RADIUS,
  }));

  // For wireframe, derive line loops from faces (each triangle as a 3-edge poly)
  const edgeSet = new Set();
  const lines = [];
  for (const [i0, i1, i2] of faces) {
    const tri = [i0, i1, i2, i0];
    lines.push(tri);
    // (optional: deduplicate edges if you want a simpler edge list)
  }

  return {
    points,
    lines,
    faces: undefined, // skip for now
    color: { r: 80, g: 160, b: 220 },
    lineWidth: 1,
  };
}
