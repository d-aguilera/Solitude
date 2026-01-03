import type { Model } from "./types.js";

export const AIRPLANE = "AIRPLANE";

export const airplaneModel: Model = {
  objectType: AIRPLANE,
  points: [
    { x: 0, y: 0.5, z: 0 }, // 0: nose tip
    { x: 0, y: -0.1, z: 0.15 }, // 1: fuselage top center
    { x: -0.1, y: 0, z: 0 }, // 2: fuselage left center
    { x: 0.1, y: 0, z: 0 }, // 3: fuselage right center
    { x: 0, y: 0, z: -0.1 }, // 4: fuselage bottom center
    { x: 0, y: -0.5, z: 0 }, // 5: tail tip (unused)
    { x: -0.5, y: -0.3, z: 0 }, // 6: left wing tip
    { x: 0.5, y: -0.3, z: 0 }, // 7: right wing tip
    { x: 0, y: -0.5, z: 0.3 }, // 8: vertical stabilizer tip
    { x: -0.025, y: -0.5, z: 0.025 }, // 9: tail top left
    { x: 0.025, y: -0.5, z: 0.025 }, // 10: tail top right
    { x: -0.025, y: -0.5, z: -0.025 }, // 11: tail bottom left
    { x: 0.025, y: -0.5, z: -0.025 }, // 12: tail bottom right
  ],
  faces: [
    [1, 0, 2], // front fuselage, top left face
    [3, 0, 1], // front fuselage, top right face
    [2, 0, 4], // front fuselage, bottom left face
    [4, 0, 3], // front fuselage, bottom right face
    [2, 6, 9], // left wing top face
    [11, 6, 2], // left wing bottom face
    [9, 6, 11], // left wing, back face
    [10, 7, 3], // right wing top face
    [3, 7, 12], // right wing bottom face
    [12, 7, 10], // right wing back face
    [9, 8, 1], // vertical stabilizer left face
    [1, 8, 10], // vertical stabilizer right face
    [10, 8, 9], // vertical stabilizer back face
    [2, 9, 1], // back fuselage, top left face
    [1, 10, 3], // back fuselage, top right face
    [4, 11, 2], // back fuselage, bottom left face
    [3, 12, 4], // back fuselage, bottom right face
    [11, 4, 12], // back fuselage, bottom face
  ],
  color: { r: 0, g: 255, b: 255 },
  lineWidth: 1,
};
