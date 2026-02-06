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

/**
 * Sample and prepare body labels:
 *  - Computes distance and speed for each body.
 *  - Projects body centers into screen space.
 *  - Chooses an 8-way direction index for label placement based on the
 *    vector from the body center toward the screen center, clamped to
 *    the nearest 45° increment.
 */
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

    // Farther to nearer so nearer labels are processed last if a
    // rasterizer wants to do any painter's-order tricks.
    sorted.sort((a, b) => b.distance - a.distance);

    const screenCenterX = surface.width * 0.5;
    const screenCenterY = surface.height * 0.5;
    const angleStepRad = (45 * Math.PI) / 180;
    const twoPi = Math.PI * 2;

    for (const { body, distance } of sorted) {
      const ndc = project(body.position);
      if (!ndc) continue;

      const anchor = ndcToScreen(ndc, surface.width, surface.height);

      const name = displayNameForBodyId(body.id);

      const distanceKm = distance / 1000;
      const speedMps = vec3.length(body.velocity);
      const speedKmh = speedMps * 3.6;

      // Vector from body center to screen center in screen space.
      const vx = screenCenterX - anchor.x;
      const vy = screenCenterY - anchor.y;

      // atan2 gives angle with 0 along +X; rotate so 0 corresponds to "up".
      let angle = Math.atan2(vy, vx) - Math.PI / 2;

      // Normalize to [0, 2π).
      if (angle < 0) {
        angle = (angle % twoPi) + twoPi;
      } else if (angle >= twoPi) {
        angle = angle % twoPi;
      }

      // Clamp to nearest 45° increment.
      const quantized = Math.round(angle / angleStepRad);
      const directionIndex = quantized & 7; // keep in [0,7]

      renderedBodyLabels.push({
        anchor,
        name,
        distanceKm,
        speedKmh,
        directionIndex,
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
