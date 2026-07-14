import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import type {
  ExternalViewDefinition,
  ExternalViewFrameUpdateParams,
} from "@solitude/plugin-api/views";
import { createAxialViewsLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const localization = createAxialViewsLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "axialViews",
    requirements: {
      mainFocus: ["controlledBody", "localFrame"],
    },
    views: {
      registerViews: (registry) => {
        for (const view of createAxialViewDefinitions(localization)) {
          registry.addView(view);
        }
      },
    },
  };
}

function createAxialViewDefinitions(
  localization: ReturnType<typeof createAxialViewsLocalization>,
): ExternalViewDefinition[] {
  return [
    {
      id: "top",
      title: localization.top,
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
      id: "front",
      title: localization.front,
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(0, 500_000, 4_850),
      layout: {
        kind: "pip",
        horizontal: "left",
        vertical: "bottom",
      },
      updateFrame: updateFrontViewFrame,
    },
    {
      id: "left",
      title: localization.left,
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(-500_000, 0, 4_850),
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
      title: localization.right,
      labelMode: "nameOnly",
      initialCameraOffset: vec3.create(500_000, 0, 4_850),
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
  mainFocus,
}: ExternalViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.right, controlledBodyFrame.right);
  vec3.scaleInto(frame.forward, -1, controlledBodyFrame.up);
  vec3.copyInto(frame.up, controlledBodyFrame.forward);
}

function updateLeftViewFrame({
  frame,
  mainFocus,
}: ExternalViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.forward, controlledBodyFrame.right);
  vec3.copyInto(frame.right, controlledBodyFrame.forward);
  vec3.scaleInto(frame.right, -1, frame.right);
}

function updateRightViewFrame({
  frame,
  mainFocus,
}: ExternalViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.forward, controlledBodyFrame.right);
  vec3.scaleInto(frame.forward, -1, frame.forward);
  vec3.copyInto(frame.right, controlledBodyFrame.forward);
}

function updateFrontViewFrame({
  frame,
  mainFocus,
}: ExternalViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.right, controlledBodyFrame.right);
  vec3.scaleInto(frame.right, -1, frame.right);
  vec3.copyInto(frame.forward, controlledBodyFrame.forward);
  vec3.scaleInto(frame.forward, -1, frame.forward);
}
