function addGround() {
  for (let x = -20; x <= 20; x++) {
    for (let y = -20; y <= 20; y++) {
      addObject(
        ground,
        groundTilePoints,
        groundTileLines,
        { dx: x * 5, dy: y * 5, dz: 0 },
        "gray",
        0.05
      );
    }
  }
}

function addCube(offset) {
  addObject(cubes, cubePoints, cubeLines, offset, "red", 1);
}

function addObject(group, points, lines, offset, color, lineWidth) {
  group.push({
    points: points.map((p) => ({
      x: p.x + offset.dx,
      y: p.y + offset.dy,
      z: p.z + offset.dz,
    })),
    lines: [...lines],
    color,
    lineWidth,
  });
}

// --- SETUP CONTEXTS ---
const WIDTH = 600;
const HEIGHT = 600;
const FPS = 1000 / 60;
const FIELD_OF_VIEW = 90;
const FOCAL_LENGTH = getFocalLength();

const canvas = document.getElementById("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext("2d");

const canvasTop = document.getElementById("topView");
canvasTop.width = WIDTH;
canvasTop.height = HEIGHT;
const ctxTop = canvasTop.getContext("2d");

// --- STATE ---

const plane = {
  x: 0,
  y: -100,
  z: 1,
  yaw: 0,
  pitch: 0,
  roll: 0,
  speed: 0.1,
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

addCube({ dx: 0, dy: 0, dz: 0.5 });
addCube({ dx: 2, dy: 2, dz: 0.5 });
addCube({ dx: 2, dy: -2, dz: 0.5 });
addCube({ dx: -2, dy: -2, dz: 0.5 });
addCube({ dx: -2, dy: 2, dz: 0.5 });

airplanes.push({
  points: planePoints,
  lines: planeLines,
  color: "cyan",
  lineWidth: 1,
});

render();
