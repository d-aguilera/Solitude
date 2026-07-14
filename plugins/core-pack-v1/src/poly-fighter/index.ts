import { parseObjMesh } from "@solitude/plugin-api/assets";
import {
  createControllableEntityProviderCapability,
  type ExternalControllableEntityProvider,
} from "@solitude/plugin-api/controllable-entities";
import { computeVolumeOfTriangleMesh, vec3 } from "@solitude/plugin-api/math";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import polyFighterObjText from "./polyFighter.obj?raw";

const POLY_FIGHTER_DENSITY_KG_PER_M3 = 2700;
const POLY_FIGHTER_MESH_SCALE = 150_000;
const polyFighterModel = parseObjMesh(polyFighterObjText);
const polyFighterMesh = createScaledPolyFighterMesh();
const polyFighterVolume = computeVolumeOfTriangleMesh(
  polyFighterMesh.points,
  polyFighterMesh.faces,
);
const polyFighterMass = POLY_FIGHTER_DENSITY_KG_PER_M3 * polyFighterVolume;

export const polyFighterProvider: ExternalControllableEntityProvider = {
  createEntity: ({ color, id, placement }) => ({
    id,
    components: {
      controllable: {
        enabled: true,
      },
      gravityMass: {
        density: POLY_FIGHTER_DENSITY_KG_PER_M3,
        volume: polyFighterVolume,
      },
      renderable: {
        color,
        mesh: polyFighterMesh,
        meshLod: { kind: "none" },
        meshShading: { kind: "flat" },
        meshScale: 1,
        role: "controlledBody",
      },
      state: {
        angularVelocity: placement.angularVelocity,
        frame: placement.frame,
        kind: "direct",
        orientation: placement.orientation,
        position: placement.position,
        velocity: placement.velocity,
      },
    },
  }),
  id: "polyFighter",
  mass: polyFighterMass,
};

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "polyFighter",
    capabilities: [
      createControllableEntityProviderCapability(polyFighterProvider),
    ],
  };
}

function createScaledPolyFighterMesh() {
  const points = polyFighterModel.points.map(vec3.clone);
  for (const point of points) {
    vec3.scaleInto(point, POLY_FIGHTER_MESH_SCALE, point);
  }

  return {
    faces: polyFighterModel.faces,
    points,
  };
}
