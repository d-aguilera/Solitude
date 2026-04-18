import {
  updateLeftViewFrame,
  updateRearViewFrame,
  updateRightViewFrame,
  updateTopViewFrame,
} from "../../app/cameras";
import type { GamePlugin } from "../../app/pluginPorts";
import type { ViewDefinition } from "../../app/viewPorts";
import { vec3 } from "../../domain/vec3";

export function createAxialViewsPlugin(): GamePlugin {
  return {
    id: "axialViews",
    views: {
      registerViews: (registry) => {
        for (const view of createAxialViewDefinitions()) {
          registry.addView(view);
        }
      },
    },
  };
}

function createAxialViewDefinitions(): ViewDefinition[] {
  return [
    {
      id: "top",
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(0, 0, 500_000),
      layout: {
        kind: "pip",
        horizontal: "right",
        vertical: "bottom",
      },
      updateFrame: updateTopViewFrame,
    },
    {
      id: "rear",
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(0, 500_000, 4_850),
      layout: {
        kind: "pip",
        horizontal: "left",
        vertical: "bottom",
      },
      updateFrame: updateRearViewFrame,
    },
    {
      id: "left",
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(500_000, 51_000, 4_850),
      layout: {
        kind: "pip",
        horizontal: "left",
        vertical: "top",
        avoidHud: true,
      },
      updateFrame: updateLeftViewFrame,
    },
    {
      id: "right",
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(-500_000, 51_000, 4_850),
      layout: {
        kind: "pip",
        horizontal: "right",
        vertical: "top",
        avoidHud: true,
      },
      updateFrame: updateRightViewFrame,
    },
  ];
}
