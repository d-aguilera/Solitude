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
const buildings = [];
const cubes = [];
const airplanes = [];

// Helper to create a building instance
function createBuilding({ centerX, centerY, width, depth, height, color }) {
  // buildingUnitModel has base 1×1, height 1 in local units.
  // We will use scale = 1 and encode dimensions into orientation matrix columns
  // so that: right = (width, 0, 0), forward = (0, depth, 0), up = (0, 0, height).
  const orientation = [
    [1, 0, 0], // right
    [0, 1, 0], // forward
    [0, 0, 1], // up
  ];

  return {
    model: buildingUnitModel,
    x: centerX,
    y: centerY,
    z: 0, // on ground
    orientation,
    scale: 1,
    color,
    lineWidth: buildingUnitModel.lineWidth,
    // store dimensions so transform can use them
    _width: width,
    _depth: depth,
    _height: height,
  };
}

function addCity() {
  const blockSize = 90; // world meters (from tile scale)
  const margin = 5; // meters inset from each edge for building line

  // Tile grid is currently from -100..100 in setup (in tile units)
  for (let dx = -20; dx <= 20; dx++) {
    for (let dy = -20; dy <= 20; dy++) {
      const blockCenterX = dx * blockSize;
      const blockCenterY = dy * blockSize;

      // Local building area bounds in world coordinates, relative to block center
      const buildMin = -blockSize / 2 + margin;
      const buildMax = blockSize / 2 - margin;

      const numBuildings = 1 + Math.floor(Math.random() * 5); // 1–5 per block

      for (let i = 0; i < numBuildings; i++) {
        const bw = 10 + Math.random() * 20; // 10–30 m width
        const bd = 10 + Math.random() * 20; // 10–30 m depth
        const bh = 10 + Math.random() * 70; // 10–80 m height

        // pick a center so building stays inside [buildMin, buildMax]
        const localXRange = buildMax - buildMin - bw;
        const localYRange = buildMax - buildMin - bd;
        if (localXRange <= 0 || localYRange <= 0) continue;

        const localX = buildMin + bw / 2 + Math.random() * localXRange;
        const localY = buildMin + bd / 2 + Math.random() * localYRange;

        const worldX = blockCenterX + localX;
        const worldY = blockCenterY + localY;

        const color = {
          r: 140 + Math.floor(Math.random() * 60),
          g: 140 + Math.floor(Math.random() * 60),
          b: 140 + Math.floor(Math.random() * 60),
        };

        const b = createBuilding({
          centerX: worldX,
          centerY: worldY,
          width: bw,
          depth: bd,
          height: bh,
          color,
        });
        buildings.push(b);
      }
    }
  }
}

addGround();
addCubes();
addAirplane();
addCity();

// --- PROFILING ---
let lastTimeMs = null;
let fps = 0;
let framesThisSecond = 0;
let lastFpsUpdateMs = 0;
let profileEveryNFrames = 60;
let frameCountForProfile = 0;

const lightDir = { x: 0.3, y: 0.5, z: 1.0 }; // arbitrary

// --- MAIN LOOP ---
requestAnimationFrame(render);
