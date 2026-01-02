export const AIRPLANE = "AIRPLANE";

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
