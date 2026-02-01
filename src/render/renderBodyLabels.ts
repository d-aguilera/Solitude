import type { PlanetSceneObject } from "../app/appPorts.js";
import type { BodyId, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../infra/allocProfiler.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type {
  NdcPoint,
  RenderSurface2D,
  RenderedBodyLabel,
} from "./renderPorts.js";

const diffScratch: Vec3 = vec3.zero();

export function renderBodyLabels(
  surface: RenderSurface2D,
  bodies: PlanetSceneObject[],
  referencePosition: Vec3,
  project: (worldPoint: Vec3) => NdcPoint | null,
): RenderedBodyLabel[] {
  return alloc.withName(renderBodyLabels.name, () => {
    const renderedBodyLabels: RenderedBodyLabel[] = [];

    const sorted: {
      body: PlanetSceneObject;
      distance: number;
    }[] = [];

    for (const body of bodies) {
      vec3.subInto(diffScratch, body.position, referencePosition);
      const d = vec3.length(diffScratch);
      sorted.push({ body, distance: d });
    }

    sorted.sort((a, b) => b.distance - a.distance);

    for (const { body, distance } of sorted) {
      const ndc = project(body.position);
      if (!ndc) continue;

      const screenPoint = ndcToScreen(ndc, surface.width, surface.height);

      const name = displayNameForBodyId(body.id);

      const dKm = distance / 1000;
      const speedMps = vec3.length(body.velocity);
      const speedKmh = speedMps * 3.6;

      renderedBodyLabels.push({
        anchor: screenPoint,
        name,
        distanceKm: dKm,
        speedKmh,
      });
    }

    return renderedBodyLabels;
  });
}

function displayNameForBodyId(id: BodyId): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
