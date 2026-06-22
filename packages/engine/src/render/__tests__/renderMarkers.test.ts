import { describe, expect, it } from "vitest";
import { vec3 } from "../../domain/vec3";
import { ndc } from "../ndc";
import { renderWorldMarkersInto } from "../renderMarkers";
import type { RenderedMarker } from "../renderPorts";

describe("renderWorldMarkersInto", () => {
  it("projects constant-screen-size marker properties", () => {
    const rendered: RenderedMarker[] = [];
    const count = renderWorldMarkersInto(
      rendered,
      [
        {
          color: { r: 255, g: 32, b: 32 },
          lineWidth: 2,
          position: vec3.create(0, 10, 0),
          radius: 6,
          shape: "cross",
        },
      ],
      800,
      600,
      (into) => {
        const center = ndc.zero();
        center.depth = 10;
        Object.assign(into, center);
        return true;
      },
    );

    expect(count).toBe(1);
    expect(rendered[0]).toMatchObject({
      cssColor: "rgb(255, 33, 33)",
      lineWidth: 2,
      position: { depth: 10, x: 400, y: 300 },
      radius: 6,
      shape: "cross",
    });
  });
});
