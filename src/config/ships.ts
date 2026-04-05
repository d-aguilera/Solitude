import type { ShipPhysicsConfig, ShipRenderConfig } from "../app/configPorts";
import { computeVolumeOfTriangleMesh } from "../domain/meshVolume";
import { km } from "../domain/units";
import { vec3 } from "../domain/vec3";
import { colors } from "./colors";
import { parseObjMesh } from "./obj";
import shipObjText from "./ship.obj?raw";

const SHIP_DENSITY_KG_PER_M3 = 2700; // used for mass calculation
const SHIP_START_ALTITUDE_M = 100 * km; // above Earth's north pole
const EARTH_RADIUS = 6_371 * km;

export function buildDefaultShipConfigs(): {
  physics: ShipPhysicsConfig[];
  render: ShipRenderConfig[];
} {
  const shipPoints = shipModel.points.map(vec3.clone);
  for (let p of shipPoints) {
    vec3.scaleInto(p, 150_000, p);
  }

  const enemyPoints = shipModel.points.map(vec3.clone);
  for (let p of enemyPoints) {
    vec3.scaleInto(p, 150_000, p);
  }

  const shipMesh = {
    faces: shipModel.faces, // safe to alias here
    points: shipPoints,
  };
  const enemyMesh = {
    faces: shipModel.faces, // safe to alias here
    points: enemyPoints,
  };

  const physics: ShipPhysicsConfig[] = [
    {
      altitude: SHIP_START_ALTITUDE_M,
      homePlanetId: "planet:earth",
      id: "ship:main",
      density: SHIP_DENSITY_KG_PER_M3,
      volume: computeVolumeOfTriangleMesh(shipMesh.points, shipMesh.faces),
    },
    {
      altitude: -2 * EARTH_RADIUS - SHIP_START_ALTITUDE_M, // opposite side
      homePlanetId: "planet:earth",
      id: "ship:enemy",
      density: SHIP_DENSITY_KG_PER_M3,
      volume: computeVolumeOfTriangleMesh(enemyMesh.points, enemyMesh.faces),
    },
  ];

  const render: ShipRenderConfig[] = [
    {
      id: "ship:main",
      color: colors.ship,
      mesh: shipMesh,
    },
    {
      id: "ship:enemy",
      color: colors.enemyShip,
      mesh: enemyMesh,
    },
  ];

  return { physics, render };
}

const shipModel = parseObjMesh(shipObjText);
