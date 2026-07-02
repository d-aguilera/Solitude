import type { WorldMarker } from "../app/pluginPorts";
import type { Vec3 } from "../domain/vec3";
import { rgbToQuantizedCss } from "./color";
import { type NdcPoint, ndc } from "./ndc";
import type { RenderedMarker } from "./renderPorts";
import { scrn } from "./scrn";

const projectedScratch = ndc.zero();

export function renderWorldMarkersInto(
  into: RenderedMarker[],
  markers: readonly WorldMarker[],
  markerCount: number,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
): number {
  let count = 0;
  for (let i = 0; i < markerCount; i++) {
    const marker = markers[i];
    if (!projectInto(projectedScratch, marker.position)) continue;

    let entry = into[count];
    if (!entry) {
      entry = into[count] = {
        position: scrn.zero(),
        cssColor: "",
        radius: 0,
        lineWidth: 0,
        shape: marker.shape,
      };
    }
    ndc.toScreenInto(
      entry.position,
      projectedScratch,
      screenWidth,
      screenHeight,
    );
    entry.cssColor = rgbToQuantizedCss(marker.color);
    entry.radius = marker.radius;
    entry.lineWidth = marker.lineWidth;
    entry.shape = marker.shape;
    count++;
  }
  return count;
}
