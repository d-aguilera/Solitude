import type { ShipBodyConfig } from "../app/appPorts.js";
import { km } from "../domain/units.js";
import { vec3 } from "../domain/vec3.js";
import { colors } from "./colors.js";

const SHIP_START_ALTITUDE_M = 100 * km; // above Earth's north pole
const EARTH_RADIUS = 6_371 * km;

export function buildDefaultShipConfigs(): ShipBodyConfig[] {
  const shipPoints = shipModel.points.map(vec3.clone);
  for (let p of shipPoints) {
    vec3.scaleInto(p, 150_000, p);
  }

  const enemyPoints = shipModel.points.map(vec3.clone);
  for (let p of enemyPoints) {
    vec3.scaleInto(p, 150_000, p);
  }

  return [
    {
      altitude: SHIP_START_ALTITUDE_M,
      color: colors.ship,
      homePlanetId: "planet:earth",
      id: "ship:main",
      mesh: {
        faces: shipModel.faces, // safe to alias here
        points: shipPoints,
      },
    },
    {
      altitude: -2 * EARTH_RADIUS - SHIP_START_ALTITUDE_M, // opposite side
      color: colors.enemyShip,
      homePlanetId: "planet:earth",
      id: "ship:enemy",
      mesh: {
        faces: shipModel.faces, // safe to alias here
        points: enemyPoints,
      },
    },
  ];
}

const shipModel = {
  points: [
    vec3.create(0, 0.5, 0), // 0: nose tip
    vec3.create(0, 0.2, 0.1), // 1: fuselage top center
    vec3.create(-0.1, 0, 0), // 2: fuselage left center
    vec3.create(0.1, 0, 0), // 3: fuselage right center
    vec3.create(0, 0, -0.1), // 4: fuselage bottom center
    vec3.create(0, -0.5, 0), // 5: tail tip (unused)
    vec3.create(-0.5, -0.3, 0), // 6: left wing tip
    vec3.create(0.5, -0.3, 0), // 7: right wing tip
    vec3.create(0, -0.5, 0.3), // 8: vertical stabilizer tip
    vec3.create(-0.025, -0.5, 0.025), // 9: tail top left
    vec3.create(0.025, -0.5, 0.025), // 10: tail top right
    vec3.create(-0.025, -0.5, -0.025), // 11: tail bottom left
    vec3.create(0.025, -0.5, -0.025), // 12: tail bottom right
    vec3.create(0, 0.2, 0), // 13: fuselage top front quarter
  ],
  faces: [
    [13, 0, 2], // front fuselage, top left face
    [3, 0, 13], // front fuselage, top right face
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
};
