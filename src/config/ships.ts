import type { ShipBodyConfig } from "../app/appPorts.js";
import { km } from "../domain/units.js";
import { vec3 } from "../domain/vec3.js";
import { colors } from "./colors.js";
import { parseObjMesh } from "./obj.js";
import shipObjText from "./ship.obj?raw";

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

const shipModel = parseObjMesh(shipObjText);
