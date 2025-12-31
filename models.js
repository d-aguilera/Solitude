export const CITY_BLOCK = "CITY_BLOCK";
export const BUILDING = "BUILDING";
export const CUBE = "CUBE";
export const AIRPLANE = "AIRPLANE";

export const cityBlockModel = {
  objectType: CITY_BLOCK,
  points: [
    { x: 0.45, y: 0.45, z: 0 },
    { x: 0.45, y: -0.45, z: 0 },
    { x: -0.45, y: -0.45, z: 0 },
    { x: -0.45, y: 0.45, z: 0 },
  ],
  lines: [[0, 1, 2, 3]],
  color: { r: 128, g: 128, b: 128 }, // gray
  lineWidth: 0.1,
};

export const buildingModel = {
  objectType: BUILDING,
  points: [
    // bottom face
    { x: 0.5, y: 0.5, z: 0 },
    { x: 0.5, y: -0.5, z: 0 },
    { x: -0.5, y: -0.5, z: 0 },
    { x: -0.5, y: 0.5, z: 0 },
    // top face
    { x: 0.5, y: 0.5, z: 1 },
    { x: 0.5, y: -0.5, z: 1 },
    { x: -0.5, y: -0.5, z: 1 },
    { x: -0.5, y: 0.5, z: 1 },
  ],
  lines: [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
  faces: [
    [0, 1, 2, 3], // bottom
    [4, 7, 6, 5], // top
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
  ],
  lineWidth: 0.8,
};

export const cubeModel = {
  objectType: CUBE,
  points: [
    // bottom face
    { x: 0.5, y: 0.5, z: -0.5 },
    { x: 0.5, y: -0.5, z: -0.5 },
    { x: -0.5, y: -0.5, z: -0.5 },
    { x: -0.5, y: 0.5, z: -0.5 },
    // top face
    { x: 0.5, y: 0.5, z: 0.5 },
    { x: 0.5, y: -0.5, z: 0.5 },
    { x: -0.5, y: -0.5, z: 0.5 },
    { x: -0.5, y: 0.5, z: 0.5 },
  ],
  lines: [
    // bottom face
    [0, 1, 2, 3],
    // top face
    [4, 5, 6, 7],
    // connecting
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
  faces: [
    // point indices, wound CCW when viewed from outside
    [0, 1, 2, 3], // bottom
    [4, 7, 6, 5], // top
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
  ],
  color: { r: 200, g: 0, b: 0 }, // red
  lineWidth: 1,
};

export const airplaneModel = {
  objectType: AIRPLANE,
  points: [
    { x: 0, y: 0.5, z: 0 }, // 0: Nose
    { x: 0, y: 0.1, z: 0.15 }, // 1: Cockpit
    { x: -0.1, y: 0, z: 0 }, // 2: Body Left
    { x: 0.1, y: 0, z: 0 }, // 3: Body Right
    { x: 0, y: 0, z: -0.1 }, // 4: Body Bottom
    { x: 0, y: -0.5, z: 0 }, // 5: Tail End
    { x: -0.5, y: -0.3, z: 0 }, // 6: Left Wing Tip
    { x: 0.5, y: -0.3, z: 0 }, // 7: Right Wing Tip
    { x: 0, y: -0.5, z: 0.3 }, // 8: Vertical Stab Top
  ],
  lines: [
    // Fuselage
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [1, 2, 4, 3],
    // Wings
    [2, 6, 5],
    [3, 7, 5],
    // Vertical Stabilizer
    [1, 8, 5],
  ],
  color: { r: 0, g: 255, b: 255 },
  lineWidth: 1,
};
