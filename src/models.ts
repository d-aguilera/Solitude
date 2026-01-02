import type { Model } from "./types.js";

export const AIRPLANE = "AIRPLANE";

export const airplaneModel: Model = {
  objectType: AIRPLANE,
  points: [
    { x: 0, y: 0.5, z: 0 }, // 0: nose tip
    { x: 0, y: 0.1, z: 0.15 }, // 1: fuselage top center
    { x: -0.1, y: 0, z: 0 }, // 2: fuselage left center
    { x: 0.1, y: 0, z: 0 }, // 3: fuselage right center
    { x: 0, y: 0, z: -0.1 }, // 4: fuselage bottom center
    { x: 0, y: -0.5, z: 0 }, // 5: tail tip
    { x: -0.5, y: -0.3, z: 0 }, // 6: left wing tip
    { x: 0.5, y: -0.3, z: 0 }, // 7: right wing tip
    { x: 0, y: -0.5, z: 0.3 }, // 8: vertical stabilizer tip
  ],
  lines: [
    [0, 1], // nose to fuselage top center
    [0, 2], // nose to fuselage left center
    [0, 3], // nose to fuselage right center
    [0, 4], // nose to fuselage bottom center
    [1, 5], // fuselage top center to tail tip
    [2, 5], // fuselage left center to tail tip
    [3, 5], // fuselage right center to tail tip
    [4, 5], // fuselage bottom center to tail tip
    [1, 2, 4, 3], // fuselage middle ring
    [2, 6, 5], // left wing
    [3, 7, 5], // right wing
    [1, 8, 5], // vertical stabilizer
  ],
  color: { r: 0, g: 255, b: 255 },
  lineWidth: 1,
};
