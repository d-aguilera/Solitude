import {
  applyBrowserOverlayProviders,
  collectBrowserOverlayProviders,
} from "@solitude/browser/dom/overlayPorts";
import { createRemoteCanvasRenderer } from "@solitude/browser/remoteCanvasRenderer";
import type { ControlInput, FramePolicy } from "@solitude/engine/plugin";
import {
  createPluginCapabilityRegistry,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type { EntityConfig } from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import { loadPlugins } from "solitude/plugins/index";

const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "hud",
  "orbitTelemetry",
  "bodyLabels",
  "axialViews",
  "trajectories",
  "velocitySegments",
];

export interface RemoteClientSnapshotMessage {
  entities: RuntimeWorldSnapshot["entities"];
  modelVersion: number;
  simulationTimeMillis: number;
  tick: number;
}

export interface SolitudeRemoteClientRendererOptions {
  canvas: HTMLCanvasElement;
  getFocusEntityId: () => string;
}

export interface SolitudeRemoteClientRenderer {
  pushSnapshotMessage: (message: RemoteClientSnapshotMessage) => void;
  renderFrame: (nowMillis: number, dtMillis: number) => boolean;
  setModel: (entities: readonly EntityConfig[], modelVersion: number) => void;
  setControlState: (controls: Partial<ControlInput>) => void;
}

export function createSolitudeRemoteClientRenderer({
  canvas,
  getFocusEntityId,
}: SolitudeRemoteClientRendererOptions): SolitudeRemoteClientRenderer {
  const plugins = loadPlugins(remoteRenderPluginIds);
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );
  const overlayProviders = collectBrowserOverlayProviders(capabilityRegistry);
  const controlInput: ControlInput = {};
  const framePolicy: FramePolicy = {
    advanceOverlay: true,
    advanceScene: true,
    advanceSim: false,
  };
  let latestSnapshot: RuntimeWorldSnapshot | null = null;
  let messageSimulationTimeMillis = 0;
  let modelVersion = 0;

  let renderer: ReturnType<typeof createRemoteCanvasRenderer> | null = null;

  return {
    pushSnapshotMessage: (message) => {
      if (message.modelVersion !== modelVersion) return;
      latestSnapshot = { entities: message.entities };
      messageSimulationTimeMillis = message.simulationTimeMillis;
    },
    renderFrame: (nowMillis, dtMillis) => {
      if (!latestSnapshot || !renderer) return false;
      const focusEntityId = getFocusEntityId();
      if (focusEntityId.length > 0) {
        renderer.setFocusEntityId(focusEntityId);
      }
      const rendered = renderer.renderSnapshot(latestSnapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
      if (!rendered) return false;
      applyBrowserOverlayProviders(
        overlayProviders,
        {
          advanceOverlay: true,
          controlInput,
          framePolicy,
          mainFocus: renderer.worldRenderer.renderParams.mainFocus,
          nowMs: nowMillis,
          primaryOverlayRasterizer: renderer.overlayRasterizer,
          simTimeMillis: messageSimulationTimeMillis,
          world: renderer.worldRenderer.mirror.world,
        },
        capabilityRegistry,
      );
      return true;
    },
    setControlState: (controls) => {
      for (const [action, value] of Object.entries(controls)) {
        if (value !== undefined) controlInput[action] = value;
      }
    },
    setModel: (entities, nextModelVersion) => {
      modelVersion = nextModelVersion;
      renderer = createRenderer(plugins, entities);
      latestSnapshot = null;
      messageSimulationTimeMillis = 0;
    },
  };

  function createRenderer(
    plugins: ReturnType<typeof loadPlugins>,
    entities: readonly EntityConfig[],
  ) {
    const config = buildWorldAndSceneConfig();
    applyWorldModelPlugins(config, plugins);
    config.entities.push(...entities);
    const focusEntityId = getFocusEntityId();
    config.mainFocusEntityId =
      focusEntityId.length > 0 ? focusEntityId : (entities[0]?.id ?? "");
    return createRemoteCanvasRenderer({
      canvas,
      config,
      plugins,
    });
  }
}
