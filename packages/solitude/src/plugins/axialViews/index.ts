import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import type {
  ViewDefinition,
  ViewFrameUpdateParams,
} from "@solitude/engine/app/viewPorts";
import { vec3 } from "@solitude/engine/domain/vec3";

export function createAxialViewsPlugin(): GamePlugin {
  return {
    id: "axialViews",
    requirements: {
      mainFocus: ["controlledBody", "localFrame"],
    },
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

function updateTopViewFrame({ frame, mainFocus }: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.right, controlledBodyFrame.right);
  vec3.scaleInto(frame.forward, -1, controlledBodyFrame.up); // forward = -up
  vec3.copyInto(frame.up, controlledBodyFrame.forward); // up = forward
}

function updateLeftViewFrame({
  frame,
  mainFocus,
}: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.forward, controlledBodyFrame.right);
  vec3.scaleInto(frame.forward, -1, frame.forward); // forward = -right
  vec3.copyInto(frame.right, controlledBodyFrame.forward);
}

function updateRightViewFrame({
  frame,
  mainFocus,
}: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.forward, controlledBodyFrame.right); // forward = right
  vec3.copyInto(frame.right, controlledBodyFrame.forward);
  vec3.scaleInto(frame.right, -1, frame.right); // right = -forward
}

function updateRearViewFrame({
  frame,
  mainFocus,
}: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.right, controlledBodyFrame.right);
  vec3.copyInto(frame.forward, controlledBodyFrame.forward);
  vec3.scaleInto(frame.forward, -1, frame.forward); // forward = -forward
}
