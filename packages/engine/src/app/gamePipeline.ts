import type { GravityEngine } from "../domain/domainPorts";
import type { WorldAndSceneConfig } from "./configPorts";
import type { ControlInput } from "./controlPorts";
import { createTickHandler } from "./game";
import { createPluginCapabilityRegistry } from "./pluginCapabilities";
import type {
  FramePolicy,
  GamePlugin,
  LoopPlugin,
  LoopState,
  PluginCapabilityRegistry,
  SceneLabelCandidate,
  SceneLabelProviderParams,
  SceneObjectFilter,
  ScenePlugin,
  SceneViewFilterParams,
  SegmentProviderParams,
  ViewControlPlugin,
  WorldMarker,
  WorldSegment,
} from "./pluginPorts";
import { validatePluginRequirements } from "./pluginRequirements";
import { assembleSimulationPlugins } from "./pluginRuntime";
import { getMainViewLookState } from "./renderConfigPorts";
import type { TickParams, WorldAndScene } from "./runtimePorts";
import { updateSceneViewCameras } from "./scene";
import type { SceneControlState } from "./scenePorts";
import type { SceneState, SceneViewState, ViewDefinition } from "./viewPorts";
import {
  createSceneViewStates,
  getRequiredPrimaryViewState,
} from "./viewRegistry";

const EMPTY_ENTITY_CONTROL_INPUTS = new Map();

export interface GamePipelineParams {
  config: WorldAndSceneConfig;
  controlInput: ControlInput;
  gravityEngine: GravityEngine;
  plugins: readonly GamePlugin[];
  viewDefinitions: readonly ViewDefinition[];
  worldAndScene: WorldAndScene;
}

export interface GamePipelineFrame {
  framePolicy: FramePolicy;
  simTimeMillis: number;
}

export interface GamePipelineView {
  definition: ViewDefinition;
  labelParams: SceneLabelProviderParams;
  objectsFilter?: SceneObjectFilter;
  sceneLabelCandidates: SceneLabelCandidate[];
  sceneView: SceneViewState;
  segmentParams: SegmentProviderParams;
  worldSegments: WorldSegment[];
  worldMarkers: WorldMarker[];
}

export interface GamePipeline {
  capabilityRegistry: PluginCapabilityRegistry;
  controlInput: ControlInput;
  sceneControlState: SceneControlState;
  sceneState: SceneState;
  views: GamePipelineView[];
  worldAndScene: WorldAndScene;
  beginFrame: (nowMs: number, dtMillis: number) => GamePipelineFrame;
  endFrame: () => void;
  prepareView: (
    view: GamePipelineView,
    includeLabels: boolean,
    includeSegments: boolean,
  ) => void;
}

export function createGamePipeline({
  config,
  controlInput,
  gravityEngine,
  plugins,
  viewDefinitions,
  worldAndScene,
}: GamePipelineParams): GamePipeline {
  const simulationAssembly = assembleSimulationPlugins(plugins, [], [], []);
  const capabilityRegistry = createPluginCapabilityRegistry(
    simulationAssembly.capabilityProviders,
  );
  const loopPlugins = plugins.flatMap((plugin) =>
    plugin.loop ? [plugin.loop] : [],
  );
  const scenePlugins = plugins.flatMap((plugin) =>
    plugin.scene ? [plugin.scene] : [],
  );
  const viewControlPlugins = plugins.flatMap((plugin) =>
    plugin.viewControls ? [plugin.viewControls] : [],
  );
  const labelPlugins = plugins.flatMap((plugin) =>
    plugin.labels ? [plugin.labels] : [],
  );
  const segmentPlugins = plugins.flatMap((plugin) =>
    plugin.segments ? [plugin.segments] : [],
  );
  const markerPlugins = plugins.flatMap((plugin) =>
    plugin.markers ? [plugin.markers] : [],
  );
  const simulationPlugins =
    simulationAssembly.createSimulationPlugins(capabilityRegistry);

  validatePluginRequirements({
    mainFocus: worldAndScene.mainFocus,
    plugins,
    world: worldAndScene.world,
  });
  for (const plugin of loopPlugins) plugin.initLoop?.({ config });
  for (const plugin of scenePlugins) {
    plugin.initScene?.({
      config,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      world: worldAndScene.world,
    });
  }

  const sceneControlState: SceneControlState = {
    mainViewLookState: getMainViewLookState(config.render),
  };
  const sceneViews = createSceneViewStates([...viewDefinitions]);
  const sceneState: SceneState = {
    primaryView: getRequiredPrimaryViewState(sceneViews),
    views: sceneViews,
  };
  const views = createPipelineViews(
    config,
    worldAndScene,
    sceneViews,
    scenePlugins,
    capabilityRegistry,
  );
  const tickParams: TickParams = {
    controlInput,
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
    dtMillis: 0,
    dtMillisSim: 0,
  };
  const tick = createTickHandler(
    gravityEngine,
    worldAndScene,
    tickParams,
    simulationPlugins,
  );
  const loopState: LoopState = { framePolicy: createDefaultFramePolicy() };
  const loopParams: Parameters<NonNullable<LoopPlugin["updateLoopState"]>>[0] =
    {
      controlInput,
      dtMillis: 0,
      mainFocus: worldAndScene.mainFocus,
      nowMs: 0,
      simTimeMillis: 0,
      state: loopState,
      world: worldAndScene.world,
    };
  const sceneParams: Parameters<NonNullable<ScenePlugin["updateScene"]>>[0] = {
    dtMillis: 0,
    dtSimMillis: 0,
    mainFocus: worldAndScene.mainFocus,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
  };
  const viewControlParams: Parameters<
    NonNullable<ViewControlPlugin["updateViewControls"]>
  >[0] = {
    controlInput,
    dtMillis: 0,
    mainFocus: worldAndScene.mainFocus,
    sceneControlState,
    sceneState,
  };
  let simTimeMillis = getInitialSimTimeMillis(loopPlugins);

  updateSceneViewCameras(
    sceneState,
    worldAndScene.mainFocus,
    sceneControlState.mainViewLookState,
  );

  return {
    capabilityRegistry,
    controlInput,
    sceneControlState,
    sceneState,
    views,
    worldAndScene,
    beginFrame: (nowMs, dtMillis) => {
      resetFramePolicy(loopState.framePolicy);
      loopParams.dtMillis = dtMillis;
      loopParams.nowMs = nowMs;
      loopParams.simTimeMillis = simTimeMillis;
      applyLoopPlugins(loopPlugins, loopParams);

      const framePolicy = loopState.framePolicy;
      const tickDtMillis = framePolicy.tickDtMillis ?? dtMillis;
      const simDtMillis = framePolicy.simDtMillis ?? tickDtMillis;
      if (framePolicy.advanceSim) {
        tickParams.dtMillis = tickDtMillis;
        tickParams.dtMillisSim = simDtMillis;
        tick();
        simTimeMillis += simDtMillis;
      }
      if (framePolicy.advanceScene) {
        viewControlParams.dtMillis = tickDtMillis;
        for (const plugin of viewControlPlugins) {
          plugin.updateViewControls?.(viewControlParams);
        }
        updateSceneViewCameras(
          sceneState,
          worldAndScene.mainFocus,
          sceneControlState.mainViewLookState,
        );
        sceneParams.dtMillis = tickDtMillis;
        sceneParams.dtSimMillis = simDtMillis;
        for (const plugin of scenePlugins) {
          plugin.updateScene?.(sceneParams);
        }
      }
      return { framePolicy, simTimeMillis };
    },
    endFrame: () => {
      loopParams.simTimeMillis = simTimeMillis;
      for (const plugin of loopPlugins) {
        plugin.afterFrame?.(loopParams)
      };
    },
    prepareView: (view, includeLabels, includeSegments) => {
      view.sceneLabelCandidates.length = 0;
      if (includeLabels) {
        for (const plugin of labelPlugins) {
          plugin.appendLabels?.(view.sceneLabelCandidates, view.labelParams);
        }
      }
      view.worldSegments.length = 0;
      view.worldMarkers.length = 0;
      if (includeSegments) {
        for (const plugin of segmentPlugins) {
          plugin.appendSegments?.(view.worldSegments, view.segmentParams);
        }
        for (const plugin of markerPlugins) {
          plugin.appendMarkers?.(view.worldMarkers, view.segmentParams);
        }
      }
    },
  };
}

function createPipelineViews(
  config: WorldAndSceneConfig,
  worldAndScene: WorldAndScene,
  sceneViews: SceneViewState[],
  scenePlugins: ScenePlugin[],
  capabilityRegistry: PluginCapabilityRegistry,
): GamePipelineView[] {
  return sceneViews.map((sceneView) => {
    const definition = sceneView.definition;
    const filterParams: SceneViewFilterParams = {
      config,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      viewId: definition.id,
      world: worldAndScene.world,
    };
    const filters = scenePlugins.flatMap((plugin) => {
      const filter = plugin.getViewObjectsFilter?.(filterParams);
      return filter ? [filter] : [];
    });
    const objectsFilter = filters.length
      ? (object: Parameters<SceneObjectFilter>[0]) =>
          filters.every((filter) => filter(object))
      : undefined;
    const sceneLabelCandidates: SceneLabelCandidate[] = [];
    const worldSegments: WorldSegment[] = [];
    const worldMarkers: WorldMarker[] = [];
    return {
      definition,
      labelParams: {
        capabilityRegistry,
        config,
        labelMode: definition.labelMode,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      },
      objectsFilter,
      sceneLabelCandidates,
      sceneView,
      segmentParams: {
        config,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      },
      worldSegments,
      worldMarkers,
    };
  });
}

function getInitialSimTimeMillis(plugins: readonly LoopPlugin[]): number {
  for (const plugin of plugins) {
    const value = plugin.getInitialSimTimeMillis?.();
    if (value != null) return value;
  }
  return 0;
}

function applyLoopPlugins(
  plugins: readonly LoopPlugin[],
  params: Parameters<NonNullable<LoopPlugin["updateLoopState"]>>[0],
): void {
  for (const plugin of plugins) {
    const policy = plugin.updateLoopState?.(params)?.framePolicy;
    if (!policy) continue;
    if (policy.advancePresentation !== undefined) {
      params.state.framePolicy.advancePresentation = policy.advancePresentation;
    }
    if (policy.advanceScene !== undefined) {
      params.state.framePolicy.advanceScene = policy.advanceScene;
    }
    if (policy.advanceSim !== undefined) {
      params.state.framePolicy.advanceSim = policy.advanceSim;
    }
    if (policy.simDtMillis !== undefined) {
      params.state.framePolicy.simDtMillis = policy.simDtMillis;
    }
    if (policy.tickDtMillis !== undefined) {
      params.state.framePolicy.tickDtMillis = policy.tickDtMillis;
    }
  }
}

function createDefaultFramePolicy(): FramePolicy {
  return { advancePresentation: true, advanceScene: true, advanceSim: true };
}

function resetFramePolicy(policy: FramePolicy): void {
  policy.advancePresentation = true;
  policy.advanceScene = true;
  policy.advanceSim = true;
  policy.simDtMillis = undefined;
  policy.tickDtMillis = undefined;
}
