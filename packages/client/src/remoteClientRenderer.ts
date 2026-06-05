import {
  applyBrowserOverlayProviders,
  collectBrowserOverlayProviders,
} from "@solitude/browser/dom/overlayPorts";
import { createRemoteCanvasRenderer } from "@solitude/browser/remoteCanvasRenderer";
import {
  loadPlugins,
  type ControlInput,
  type FramePolicy,
  type GamePlugin,
} from "@solitude/engine/plugin";
import {
  createPhysicsWorkspace,
  createPluginCapabilityRegistry,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type { EntityConfig, EntityId } from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import type { SolitudeInputSequence } from "@solitude/protocol/protocol";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import type { SpacecraftControlState } from "@solitude/sim/plugins/spacecraftOperator/controlLogic";
import { applySpacecraftVehicleDynamics } from "@solitude/sim/plugins/spacecraftOperator/core";
import {
  createPluginCompositionContext,
  remoteRenderPluginIds,
  solitudePluginCatalog,
} from "solitude/plugins/catalog";
import {
  acknowledgeLocalInputs,
  createLocalPredictionState,
  hasActiveLocalPrediction,
  recordLocalInput,
} from "./localPrediction";

export interface RemoteClientSnapshotMessage {
  entities: RuntimeWorldSnapshot["entities"];
  lastProcessedInputSequences: Record<EntityId, SolitudeInputSequence>;
  modelVersion: number;
  simulationTimeMillis: number;
  tick: number;
}

export interface SolitudeRemoteClientRendererOptions {
  canvas: HTMLCanvasElement;
  getFocusEntityId: () => string;
  plugins?: GamePlugin[];
}

export interface SolitudeRemoteClientRenderer {
  pushSnapshotMessage: (message: RemoteClientSnapshotMessage) => void;
  renderFrame: (nowMillis: number, dtMillis: number) => boolean;
  setModel: (entities: readonly EntityConfig[], modelVersion: number) => void;
  setControlState: (
    controls: Partial<ControlInput>,
    inputSequence: SolitudeInputSequence,
  ) => void;
}

const maxPredictionMillis = 250;

export function createSolitudeRemoteClientRenderer({
  canvas,
  getFocusEntityId,
  plugins: clientPlugins = [],
}: SolitudeRemoteClientRendererOptions): SolitudeRemoteClientRenderer {
  const plugins = loadPlugins({
    catalog: solitudePluginCatalog,
    context: createPluginCompositionContext(),
    ids: remoteRenderPluginIds,
  }).concat(clientPlugins);
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );
  const overlayProviders = collectBrowserOverlayProviders(capabilityRegistry);
  const predictionState = createLocalPredictionState();
  const framePolicy: FramePolicy = {
    advanceOverlay: true,
    advanceScene: true,
    advanceSim: false,
  };
  let latestSnapshot: RuntimeWorldSnapshot | null = null;
  let latestSnapshotReceivedAtMillis = 0;
  let messageSimulationTimeMillis = 0;
  let modelVersion = 0;

  let renderer: ReturnType<typeof createRemoteCanvasRenderer> | null = null;
  const predictionControlState: SpacecraftControlState = { thrustLevel: 1 };
  const predictionPhysicsWorkspace = createPhysicsWorkspace();

  return {
    pushSnapshotMessage: (message) => {
      if (message.modelVersion !== modelVersion) return;
      latestSnapshot = { entities: message.entities };
      latestSnapshotReceivedAtMillis = performance.now();
      messageSimulationTimeMillis = message.simulationTimeMillis;
      const focusEntityId = getFocusEntityId();
      if (focusEntityId.length > 0) {
        acknowledgeLocalInputs(
          predictionState,
          focusEntityId,
          message.lastProcessedInputSequences,
        );
      }
    },
    renderFrame: (nowMillis, dtMillis) => {
      if (!latestSnapshot || !renderer) return false;
      resizeCanvasToDisplaySize(canvas);
      const focusEntityId = getFocusEntityId();
      if (focusEntityId.length > 0) {
        renderer.setFocusEntityId(focusEntityId);
      }
      const predictionMillis = getPredictionMillis(nowMillis);
      const rendered = renderPredictedSnapshot(
        renderer,
        latestSnapshot,
        focusEntityId,
        predictionMillis,
        dtMillis,
      );
      if (!rendered) return false;
      applyBrowserOverlayProviders(
        overlayProviders,
        {
          advanceOverlay: true,
          controlInput: predictionState.controlInput,
          framePolicy,
          mainFocus: renderer.worldRenderer.renderParams.mainFocus,
          nowMs: nowMillis,
          primaryOverlayRasterizer: renderer.overlayRasterizer,
          simTimeMillis: messageSimulationTimeMillis + predictionMillis,
          world: renderer.worldRenderer.mirror.world,
        },
        capabilityRegistry,
      );
      return true;
    },
    setControlState: (controls, inputSequence) => {
      recordLocalInput(predictionState, controls, inputSequence);
    },
    setModel: (entities, nextModelVersion) => {
      modelVersion = nextModelVersion;
      renderer = createRenderer(plugins, entities);
      latestSnapshot = null;
      latestSnapshotReceivedAtMillis = 0;
      messageSimulationTimeMillis = 0;
      predictionState.pendingInputs.splice(
        0,
        predictionState.pendingInputs.length,
      );
      predictionState.controlInput = {};
      predictionControlState.thrustLevel = 1;
    },
  };

  function renderPredictedSnapshot(
    renderer: ReturnType<typeof createRemoteCanvasRenderer>,
    snapshot: RuntimeWorldSnapshot,
    focusEntityId: string,
    predictionMillis: number,
    dtMillis: number,
  ): boolean {
    if (
      focusEntityId.length === 0 ||
      predictionMillis <= 0 ||
      !hasActiveLocalPrediction(predictionState)
    ) {
      return renderer.renderSnapshot(snapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
    }

    if (!renderer.worldRenderer.mirror.applySnapshot(snapshot)) return false;
    applyLocalPrediction(renderer, focusEntityId, predictionMillis);
    renderer.renderCurrent({
      dtMillis,
      dtSimMillis: predictionMillis,
    });
    return true;
  }

  function applyLocalPrediction(
    renderer: ReturnType<typeof createRemoteCanvasRenderer>,
    focusEntityId: string,
    predictionMillis: number,
  ): void {
    const world = renderer.worldRenderer.mirror.world;
    const controlledBody = world.controllableBodies.find(
      (body) => body.id === focusEntityId,
    );
    if (!controlledBody) return;
    applySpacecraftVehicleDynamics({
      controlInput: predictionState.controlInput,
      controlPlugins: [],
      controlState: predictionControlState,
      controlledBody,
      dtMillis: predictionMillis,
      physicsWorkspace: predictionPhysicsWorkspace,
      propulsionResolvers: [],
      world,
    });
  }

  function getPredictionMillis(nowMillis: number): number {
    if (latestSnapshotReceivedAtMillis <= 0) return 0;
    return Math.min(
      maxPredictionMillis,
      Math.max(0, nowMillis - latestSnapshotReceivedAtMillis),
    );
  }

  function createRenderer(
    plugins: GamePlugin[],
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

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth <= 0 || cssHeight <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  const deviceWidth = Math.round(cssWidth * dpr);
  const deviceHeight = Math.round(cssHeight * dpr);
  if (canvas.width === deviceWidth && canvas.height === deviceHeight) return;

  canvas.width = deviceWidth;
  canvas.height = deviceHeight;
}
