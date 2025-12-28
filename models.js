const groundTileModel = {
  points: [
    { x: 0.45, y: 0.45, z: 0 },
    { x: 0.45, y: -0.45, z: 0 },
    { x: -0.45, y: -0.45, z: 0 },
    { x: -0.45, y: 0.45, z: 0 },
  ],
  lines: [[0, 1, 2, 3]],
  color: "gray",
  lineWidth: 0.1,
};

const cubeModel = {
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
  color: "red",
  lineWidth: 1,
};

const airplaneModel = {
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
    [0, 4], // Nose connections
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5], // Tail connections
    [1, 2],
    [2, 4],
    [4, 3],
    [3, 1], // Mid-body cross section
    // Wings
    [2, 6],
    [6, 5],
    [5, 2], // Left Wing
    [3, 7],
    [7, 5],
    [5, 3], // Right Wing
    // Vertical Stabilizer
    [1, 8],
    [8, 5],
    [5, 1],
  ],
  color: "cyan",
  lineWidth: 1,
};
