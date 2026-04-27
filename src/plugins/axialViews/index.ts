import type { GamePlugin } from "../../app/pluginPorts";
import type {
  ViewDefinition,
  ViewFrameUpdateParams,
} from "../../app/viewPorts";
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

function updateTopViewFrame({
  frame,
  mainControlledBody,
}: ViewFrameUpdateParams): void {
  const { right, forward, up } = mainControlledBody.frame;
  vec3.copyInto(frame.right, right);
  vec3.scaleInto(frame.forward, -1, up); // forward = -up
  vec3.copyInto(frame.up, forward); // up = forward
}

function updateLeftViewFrame({
  frame,
  mainControlledBody,
}: ViewFrameUpdateParams): void {
  const { right, forward, up } = mainControlledBody.frame;
  vec3.copyInto(frame.up, up);
  vec3.copyInto(frame.forward, right);
  vec3.scaleInto(frame.forward, -1, frame.forward); // forward = -right
  vec3.copyInto(frame.right, forward);
}

function updateRightViewFrame({
  frame,
  mainControlledBody,
}: ViewFrameUpdateParams): void {
  const { right, forward, up } = mainControlledBody.frame;
  vec3.copyInto(frame.up, up);
  vec3.copyInto(frame.forward, right); // forward = right
  vec3.copyInto(frame.right, forward);
  vec3.scaleInto(frame.right, -1, frame.right); // right = -forward
}

function updateRearViewFrame({
  frame,
  mainControlledBody,
}: ViewFrameUpdateParams): void {
  const { right, forward, up } = mainControlledBody.frame;
  vec3.copyInto(frame.up, up);
  vec3.copyInto(frame.right, right);
  vec3.copyInto(frame.forward, forward);
  vec3.scaleInto(frame.forward, -1, frame.forward); // forward = -forward
}
