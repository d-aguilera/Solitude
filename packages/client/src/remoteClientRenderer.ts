import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import {
  initLayout,
  resizeLayout,
  type LayoutView,
} from "@solitude/browser/dom/layout";
import {
  applyBrowserOverlayProviders,
  collectBrowserOverlayProviders,
} from "@solitude/browser/dom/overlayPorts";
import { createRemoteMultiCanvasRenderer } from "@solitude/browser/remoteCanvasRenderer";
import {
  remoteRenderPluginCatalog,
  remoteRenderPluginIds,
} from "@solitude/display/plugins/catalog";
import {
  loadPlugins,
  type ControlInput,
  type FramePolicy,
  type GamePlugin,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import {
  buildViewDefinitions,
  type ViewDefinition,
  type ViewLayout,
} from "@solitude/engine/render";
import {
  createPhysicsWorkspace,
  createPluginCapabilityRegistry,
  type RuntimeEntitySnapshot,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type {
  ControlledBody,
  EntityConfig,
  EntityId,
} from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import type { SolitudeInputSequence } from "@solitude/protocol/protocol";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import type { SpacecraftControlState } from "@solitude/sim/plugins/spacecraftOperator/controlLogic";
import { applySpacecraftVehicleDynamics } from "@solitude/sim/plugins/spacecraftOperator/core";
import {
  acknowledgeLocalInputs,
  createLocalPredictionState,
  hasActiveLocalPrediction,
  recordLocalInput,
} from "./localPrediction";
import {
  applyLocalVisualCorrection,
  captureLocalShipVisualState,
  copyLocalPredictionErrorMetrics,
  createLocalReconciliationState,
  reconcileLocalShipVisualState,
  restoreLocalShipVisualState,
  type LocalPredictionErrorMetrics,
  type LocalShipVisualState,
} from "./localReconciliation";

declare global {
  interface Window {
    __solitudePredictionMetrics?: LocalPredictionErrorMetrics;
  }
}

export interface RemoteClientSnapshotMessage {
  entities: RuntimeWorldSnapshot["entities"];
  lastProcessedInputSequences: Record<EntityId, SolitudeInputSequence>;
  modelVersion: number;
  simulationTimeMillis: number;
  tick: number;
}

export interface SolitudeRemoteClientRendererOptions {
  container: Element;
  getFocusEntityId: () => string;
  plugins?: GamePlugin[];
  runtimeOptions?: RuntimeOptions;
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
  container,
  getFocusEntityId,
  plugins: clientPlugins = [],
  runtimeOptions = {},
}: SolitudeRemoteClientRendererOptions): SolitudeRemoteClientRenderer {
  const plugins = loadPlugins({
    catalog: {
      ...remoteRenderPluginCatalog,
      hud: createHudOverlayPlugin,
    },
    ids: ["hud", ...remoteRenderPluginIds],
    runtimeOptions,
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

  let renderer: ReturnType<typeof createRemoteMultiCanvasRenderer> | null =
    null;
  let rendererCanvases: readonly HTMLCanvasElement[] = [];
  const layoutViews: LayoutView[] = [];
  let layoutInitialized = false;
  const predictionControlState: SpacecraftControlState = { thrustLevel: 1 };
  const predictionPhysicsWorkspace = createPhysicsWorkspace();
  const reconciliationState = createLocalReconciliationState();
  let lastPredictedLocalState: LocalShipVisualState | null = null;
  let lastRenderedLocalState: LocalShipVisualState | null = null;

  return {
    pushSnapshotMessage: (message) => {
      if (message.modelVersion !== modelVersion) return;
      const nowMillis = performance.now();
      latestSnapshot = { entities: message.entities };
      latestSnapshotReceivedAtMillis = nowMillis;
      messageSimulationTimeMillis = message.simulationTimeMillis;
      const focusEntityId = getFocusEntityId();
      if (focusEntityId.length > 0) {
        acknowledgeLocalInputs(
          predictionState,
          focusEntityId,
          message.lastProcessedInputSequences,
        );
        const authoritativeState = findSnapshotEntity(
          message.entities,
          focusEntityId,
        );
        if (authoritativeState) {
          reconcileLocalShipVisualState(
            reconciliationState,
            lastPredictedLocalState,
            lastRenderedLocalState,
            authoritativeState,
            nowMillis,
          );
          publishPredictionMetrics();
        }
      }
    },
    renderFrame: (nowMillis, dtMillis) => {
      if (!latestSnapshot || !renderer) return false;
      resizeCanvasesToDisplaySize(rendererCanvases);
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
        nowMillis,
      );
      if (!rendered) return false;
      applyBrowserOverlayProviders(
        overlayProviders,
        {
          advanceOverlay: true,
          controlInput: predictionState.controlInput,
          framePolicy,
          mainFocus: renderer.worldRenderer.primaryView.renderParams.mainFocus,
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
      rendererCanvases = renderer.views.map((view) => view.canvas);
      latestSnapshot = null;
      latestSnapshotReceivedAtMillis = 0;
      messageSimulationTimeMillis = 0;
      predictionState.pendingInputs.splice(
        0,
        predictionState.pendingInputs.length,
      );
      predictionState.controlInput = {};
      predictionControlState.thrustLevel = 1;
      reconciliationState.correction.active = false;
      lastPredictedLocalState = null;
      lastRenderedLocalState = null;
    },
  };

  function renderPredictedSnapshot(
    renderer: ReturnType<typeof createRemoteMultiCanvasRenderer>,
    snapshot: RuntimeWorldSnapshot,
    focusEntityId: string,
    predictionMillis: number,
    dtMillis: number,
    nowMillis: number,
  ): boolean {
    if (
      focusEntityId.length === 0 ||
      !shouldUseLocalRenderPath(predictionMillis)
    ) {
      return renderer.renderSnapshot(snapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
    }

    if (!renderer.worldRenderer.mirror.applySnapshot(snapshot)) return false;
    const controlledBody = findControlledBody(renderer, focusEntityId);
    if (!controlledBody) {
      return renderer.renderSnapshot(snapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
    }

    if (shouldPredictLocalShip(predictionMillis)) {
      applyLocalPrediction(renderer, controlledBody, predictionMillis);
    }
    lastPredictedLocalState = captureLocalShipVisualState(
      lastPredictedLocalState,
      controlledBody,
    );
    applyLocalVisualCorrection(reconciliationState, controlledBody, nowMillis);
    lastRenderedLocalState = captureLocalShipVisualState(
      lastRenderedLocalState,
      controlledBody,
    );
    renderer.renderCurrent({
      dtMillis,
      dtSimMillis: predictionMillis,
    });
    restoreLocalShipVisualState(controlledBody, lastPredictedLocalState);
    return true;
  }

  function applyLocalPrediction(
    renderer: ReturnType<typeof createRemoteMultiCanvasRenderer>,
    controlledBody: ControlledBody,
    predictionMillis: number,
  ): void {
    const world = renderer.worldRenderer.mirror.world;
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

  function shouldUseLocalRenderPath(predictionMillis: number): boolean {
    return (
      shouldPredictLocalShip(predictionMillis) ||
      reconciliationState.correction.active
    );
  }

  function shouldPredictLocalShip(predictionMillis: number): boolean {
    return predictionMillis > 0 && hasActiveLocalPrediction(predictionState);
  }

  function findControlledBody(
    renderer: ReturnType<typeof createRemoteMultiCanvasRenderer>,
    focusEntityId: string,
  ) {
    return renderer.worldRenderer.mirror.world.controllableBodies.find(
      (body) => body.id === focusEntityId,
    );
  }

  function findSnapshotEntity(
    entities: readonly RuntimeEntitySnapshot[],
    entityId: EntityId,
  ): RuntimeEntitySnapshot | undefined {
    return entities.find((entity) => entity.id === entityId);
  }

  function publishPredictionMetrics(): void {
    window.__solitudePredictionMetrics = copyLocalPredictionErrorMetrics(
      reconciliationState.metrics,
    );
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
    const viewDefinitions = buildViewDefinitions(config, plugins);
    const viewCanvases = createViewCanvases(container, viewDefinitions);
    replaceLayoutViews(layoutViews, viewCanvases);
    if (layoutInitialized) {
      resizeLayout(container, layoutViews);
    } else {
      initLayout(container, layoutViews);
      layoutInitialized = true;
    }
    return createRemoteMultiCanvasRenderer({
      config,
      plugins,
      views: viewCanvases.map((view) => ({
        canvas: view.canvas,
        viewId: view.definition.id,
      })),
    });
  }
}

function createViewCanvases(
  container: Element,
  definitions: readonly ViewDefinition[],
): {
  canvas: HTMLCanvasElement;
  definition: ViewDefinition;
  layout: ViewLayout;
}[] {
  const views: {
    canvas: HTMLCanvasElement;
    definition: ViewDefinition;
    layout: ViewLayout;
  }[] = [];
  let index = 0;
  for (const definition of primaryDefinitionsFirst(definitions)) {
    const canvas = getOrCreateViewCanvas(
      container,
      createViewCanvasId(index),
      definition,
    );
    views.push({ canvas, definition, layout: definition.layout });
    index++;
  }
  removeExtraViewCanvases(container, index);
  return views;
}

function replaceLayoutViews(
  into: LayoutView[],
  views: readonly LayoutView[],
): void {
  into.length = 0;
  into.push(...views);
}

function primaryDefinitionsFirst(
  definitions: readonly ViewDefinition[],
): ViewDefinition[] {
  const ordered: ViewDefinition[] = [];
  for (const definition of definitions) {
    if (definition.layout.kind === "primary") ordered.push(definition);
  }
  for (const definition of definitions) {
    if (definition.layout.kind !== "primary") ordered.push(definition);
  }
  return ordered;
}

function getOrCreateViewCanvas(
  container: Element,
  elementId: string,
  definition: ViewDefinition,
): HTMLCanvasElement {
  let canvas = document.getElementById(elementId) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = elementId;
  }

  canvas.classList.toggle("pip-canvas", definition.layout.kind === "pip");
  if (canvas.parentElement !== container) {
    container.appendChild(canvas);
  }

  return canvas;
}

function removeExtraViewCanvases(container: Element, nextIndex: number): void {
  for (;;) {
    const canvas = document.getElementById(createViewCanvasId(nextIndex));
    if (!canvas || canvas.parentElement !== container) return;
    canvas.remove();
    nextIndex++;
  }
}

function createViewCanvasId(index: number): string {
  return `sceneViewCanvas-${index}`;
}

function resizeCanvasesToDisplaySize(canvases: readonly HTMLCanvasElement[]) {
  for (const canvas of canvases) {
    resizeCanvasToDisplaySize(canvas);
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
