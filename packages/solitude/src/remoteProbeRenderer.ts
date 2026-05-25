import { createRemoteCanvasRenderer } from "@solitude/browser/remoteCanvasRenderer";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig";
import { loadPlugins } from "./plugins/index";

const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "bodyLabels",
  "axialViews",
  "trajectories",
  "velocitySegments",
];

export interface RemoteProbeSnapshotMessage {
  snapshot: RuntimeWorldSnapshot;
  tick: number;
}

export interface SolitudeRemoteProbeRendererOptions {
  canvas: HTMLCanvasElement;
  getFocusEntityId: () => string;
  statusElement: Element;
}

export interface SolitudeRemoteProbeRenderer {
  renderSnapshotMessage: (message: RemoteProbeSnapshotMessage) => boolean;
}

export function createSolitudeRemoteProbeRenderer({
  canvas,
  getFocusEntityId,
  statusElement,
}: SolitudeRemoteProbeRendererOptions): SolitudeRemoteProbeRenderer {
  const plugins = loadPlugins(remoteRenderPluginIds);
  const config = buildWorldAndSceneConfig();
  applyWorldModelPlugins(config, plugins);

  const renderer = createRemoteCanvasRenderer({
    canvas,
    config,
    plugins,
  });

  return {
    renderSnapshotMessage: (message) => {
      const focusEntityId = getFocusEntityId();
      const focusChanged =
        focusEntityId.length > 0
          ? renderer.setFocusEntityId(focusEntityId)
          : false;
      const rendered = renderer.renderSnapshot(message.snapshot, {
        dtMillis: 0,
        dtSimMillis: 0,
      });
      if (!rendered) return false;

      statusElement.textContent =
        "engine rendered tick " +
        message.tick +
        " | focus " +
        (focusChanged
          ? focusEntityId
          : renderer.worldRenderer.renderParams.mainFocus.entityId) +
        " | faces " +
        renderer.renderedView.faceCount +
        " | labels " +
        renderer.renderedView.sceneLabelCount +
        " | segments " +
        renderer.renderedView.segmentCount;
      return true;
    },
  };
}
