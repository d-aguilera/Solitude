function clone(obj) {
  return { ...obj, points: obj.points.map((p) => ({ ...p })) };
}

function scale(obj, s) {
  for (let p of obj.points) {
    p.x *= s;
    p.y *= s;
    p.z *= s;
  }
  return obj;
}

function orient(obj, newOri) {
  const R = newOri;
  obj.points.forEach((p) => {
    const x = p.x;
    const y = p.y;
    const z = p.z;
    // R is 3x3, rows = axes in world space
    const rx = R[0][0] * x + R[0][1] * y + R[0][2] * z;
    const ry = R[1][0] * x + R[1][1] * y + R[1][2] * z;
    const rz = R[2][0] * x + R[2][1] * y + R[2][2] * z;
    p.x = rx;
    p.y = ry;
    p.z = rz;
  });
  return obj;
}

function move(obj, { dx, dy, dz }) {
  for (let p of obj.points) {
    p.x += dx;
    p.y += dy;
    p.z += dz;
  }
  return obj;
}

function addGround() {
  const tileWorldScale = 100; // tile size scale factor -> 0.9 * 100 ≈ 90 m across
  for (let dx = -100; dx <= 100; dx++) {
    for (let dy = -100; dy <= 100; dy++) {
      const offset = { dx, dy, dz: 0 };
      const tile = scale(move(clone(groundTileModel), offset), tileWorldScale);
      tile.center = getCenterOfMass(tile);
      ground.push(tile);
    }
  }
}

function addCubes() {
  const cubeWorldScale = 20; // 1-unit cube -> 20 m buildings
  const locations = [
    { x: 0, y: 0 },
    { x: 2, y: 2 },
    { x: 2, y: -2 },
    { x: -2, y: -2 },
    { x: -2, y: 2 },
  ];
  for (let i = 0; i < locations.length; i++) {
    const offset = { dx: locations[i].x, dy: locations[i].y, dz: 0 };
    const cube = scale(move(clone(cubeModel), offset), cubeWorldScale);
    cube.center = getCenterOfMass(cube);
    cubes.push(cube);
  }
}

function addAirplane() {
  airplanes.push({
    model: airplaneModel,
    x: plane.x,
    y: plane.y,
    z: plane.z,
    orientation: plane.orientation,
    scale: plane.scale,
    color: airplaneModel.color,
    lineWidth: airplaneModel.lineWidth,
  });
}

function getFocalLength() {
  const fovRad = (FIELD_OF_VIEW * Math.PI) / 180;
  return 1 / Math.tan(fovRad / 2);
}

// --- SETUP CONTEXTS ---
const WIDTH = 600;
const HEIGHT = 600;

const FIELD_OF_VIEW = 90;
const FOCAL_LENGTH = getFocalLength();
const MAX_TILE_DIST = 2000; // e.g. show tiles within 2000 m radius of plane

const canvas = document.getElementById("pilotViewCanvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctxPilot = canvas.getContext("2d");

const canvasTop = document.getElementById("topViewCanvas");
canvasTop.width = WIDTH;
canvasTop.height = HEIGHT;
const ctxTop = canvasTop.getContext("2d");

// --- STATE ---

const plane = {
  x: 0, // meters
  y: -1000, // meters
  z: 100, // meters altitude
  // Orientation as a 3x3 matrix, columns = local axes in world space
  // Start pointing along +Y
  orientation: [
    [1, 0, 0], // right (column 0)
    [0, 1, 0], // forward (column 1)
    [0, 0, 1], // up (column 2)
  ],
  speed: 250, // m/s, ~485 knots (subsonic “fast jet” cruise)
  scale: 15, // meters, approximate F-16 length
};

const pilot = {
  azimuth: 0,
  elevation: 0,
};

const topCamera = {
  x: 0,
  y: 0,
  z: 200,
};

const ground = [];
const cubes = [];
const airplanes = [];

addGround();
addCubes();
addAirplane();

// --- PROFILING ---
let lastTimeMs = null;
let fps = 0;
let framesThisSecond = 0;
let lastFpsUpdateMs = 0;
let profileEveryNFrames = 60;
let frameCountForProfile = 0;

// --- MAIN LOOP ---
requestAnimationFrame(render);
