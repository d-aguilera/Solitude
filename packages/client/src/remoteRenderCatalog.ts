import {
  createPluginCapabilityProvider,
  type BrowserOverlayContext,
  type BrowserOverlayProvider,
} from "@solitude/browser/dom/overlayPorts";
import {
  getDominantBodyPrimary,
  mat3,
  vec3,
  type Vec3,
} from "@solitude/engine/math";
import type {
  GamePlugin,
  PluginCapabilityRegistry,
  PluginCatalog,
  SceneLabelCandidate,
  SceneLabelPlugin,
  SegmentPlugin,
  WorldSegment,
} from "@solitude/engine/plugin";
import {
  formatDistance,
  formatSpeed,
  type PolylineSceneObject,
  type RGB,
  type Scene,
  type ViewDefinition,
  type ViewFrameUpdateParams,
} from "@solitude/engine/render";
import type {
  ControlledBody,
  EntityConfig,
  KeplerianOrbit,
  World,
  WorldAndSceneConfig,
} from "@solitude/engine/world";
import {
  clearHudGrid,
  createHudGrid,
  createHudPanelProvider,
  hudPanelCapability,
  isHudPanelProvider,
  type HudContext,
  type HudPanelProvider,
} from "@solitude/sim/hud/provider";
import { createAutopilotPlugin } from "@solitude/sim/plugins/autopilot";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";

export const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "hud",
  "orbitTelemetry",
  "shipTelemetry",
  "autopilot",
  "bodyLabels",
  "axialViews",
  "trajectories",
  "velocitySegments",
];

export const remoteRenderPluginCatalog: PluginCatalog = {
  autopilot: createAutopilotPlugin,
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  hud: createHudPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

function createHudPlugin(): GamePlugin {
  const grid = createHudGrid();
  const hudContextScratch = {} as HudContext;
  let providers: readonly HudPanelProvider[] | null = null;

  const renderOverlay = (
    context: BrowserOverlayContext,
    capabilityRegistry: PluginCapabilityRegistry,
  ) => {
    providers ??= capabilityRegistry
      .getAll(hudPanelCapability)
      .filter(isHudPanelProvider);

    if (context.advanceOverlay) {
      clearHudGrid(grid);
      hudContextScratch.capabilityRegistry = capabilityRegistry;
      hudContextScratch.controlInput = context.controlInput;
      hudContextScratch.mainFocus = context.mainFocus;
      hudContextScratch.nowMs = context.nowMs;
      hudContextScratch.simTimeMillis = context.simTimeMillis;
      hudContextScratch.world = context.world;
      for (const provider of providers) {
        provider.writeHud(grid, hudContextScratch);
      }
    }

    context.primaryOverlayRasterizer?.drawHud(grid);
  };

  const provider: BrowserOverlayProvider = { renderOverlay };

  return {
    id: "hud",
    capabilities: [createPluginCapabilityProvider(provider)],
  };
}

function createOrbitTelemetryPlugin(): GamePlugin {
  return {
    id: "orbitTelemetry",
    capabilities: [createHudPanelProvider(createOrbitHudPanel())],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}

function createOrbitHudPanel(): HudPanelProvider {
  const relativePosition = vec3.zero();
  const relativeVelocity = vec3.zero();

  return {
    writeHud: (grid, context) => {
      const primary = getDominantBodyPrimary(
        context.world,
        context.mainFocus.controlledBody.position,
      );
      if (!primary) return;

      vec3.subInto(
        relativePosition,
        context.mainFocus.controlledBody.position,
        primary.body.position,
      );
      vec3.subInto(
        relativeVelocity,
        context.mainFocus.controlledBody.velocity,
        primary.body.velocity,
      );

      grid[0][0] = "Orbit: ".concat(formatDisplayNameFromId(primary.id));
      grid[1][0] = "Alt: ".concat(
        formatDistance(vec3.length(relativePosition) - primary.radius),
      );
      grid[2][0] = "Rel v: ".concat(formatSpeed(vec3.length(relativeVelocity)));
    },
  };
}

function createShipTelemetryPlugin(): GamePlugin {
  return {
    id: "shipTelemetry",
    capabilities: [createHudPanelProvider(createShipHudPanel())],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}

function createShipHudPanel(): HudPanelProvider {
  return {
    writeHud: (grid, context) => {
      const speedMps = vec3.length(context.mainFocus.controlledBody.velocity);
      grid[0][4] = "Speed: ".concat(formatSpeed(speedMps));
    },
  };
}

function createBodyLabelsPlugin(): GamePlugin {
  return {
    id: "bodyLabels",
    labels: createSceneLabelPlugin(),
  };
}

type MutableSceneLabelCandidate = SceneLabelCandidate & {
  lines: string[];
};

function createSceneLabelPlugin(): SceneLabelPlugin {
  const distanceScratch: Vec3 = vec3.zero();
  const candidatesById = new Map<string, MutableSceneLabelCandidate>();
  const displayNamesById = new Map<string, string>();

  return {
    appendLabels: (into, params) => {
      const referencePosition = params.mainFocus.controlledBody.position;
      for (const object of params.scene.objects) {
        if (object.kind !== "orbitalBody" && object.kind !== "lightEmitter") {
          continue;
        }

        vec3.subInto(distanceScratch, object.position, referencePosition);
        const distance = vec3.length(distanceScratch);
        const candidate = getLabelCandidate(candidatesById, object.id);
        candidate.anchor = object.position;
        candidate.parentId = object.centralEntityId;
        candidate.priority = -distance;
        writeLabelLines(
          candidate.lines,
          params.labelMode,
          getDisplayName(displayNamesById, object.id),
          distance,
          vec3.length(object.velocity),
        );
        into.push(candidate);
      }
    },
  };
}

function createAxialViewsPlugin(): GamePlugin {
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

function createVelocitySegmentsPlugin(): GamePlugin {
  return {
    id: "velocitySegments",
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
    segments: createVelocitySegments(),
  };
}

function createTrajectoriesPlugin(): GamePlugin {
  let trajectoryList: Trajectory[] = [];

  return {
    id: "trajectories",
    scene: {
      initScene: (params) => {
        const trajectoryPlan = buildTrajectoryPlan(
          params.world,
          params.config.entities,
        );
        addTrajectorySceneObjects(
          params.scene,
          params.world,
          params.config,
          trajectoryPlan,
        );
        trajectoryList = bindTrajectoryPlanToScene(
          params.scene,
          trajectoryPlan,
        );
      },
      updateScene: (params) => {
        updateTrajectories(params.dtSimMillis, trajectoryList);
      },
    },
  };
}

interface TrajectoryPlan {
  pathId: string;
  capacity: number;
  intervalMillis: number;
}

interface Trajectory {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: PolylineSceneObject;
}

function buildTrajectoryPlan(
  world: World,
  entityConfigs: EntityConfig[],
): TrajectoryPlan[] {
  const plan: TrajectoryPlan[] = [];

  for (const ship of world.controllableBodies) {
    plan.push({
      pathId: trajectoryIdForShip(ship.id),
      capacity: 3 * 24 * 10,
      intervalMillis: 20 * 60 * 1000,
    });
  }

  for (const cfg of getTrajectoryPlanetConfigs(entityConfigs)) {
    if (cfg.centralEntityId !== "planet:sun") continue;
    const body = getById(world.entityStates, cfg.id, "Entity state");
    const speedMps = vec3.length(body.velocity);
    const speedMpMs = speedMps / 1000;
    const orbitLengthMeters = orbitalEllipseLength(cfg.orbit);
    const capacity = 360;
    const intervalLengthMeters = orbitLengthMeters / capacity;
    const intervalMillis = intervalLengthMeters / speedMpMs;
    plan.push({
      pathId: trajectoryIdForPlanet(cfg.id),
      capacity,
      intervalMillis,
    });
  }

  return plan;
}

function addTrajectorySceneObjects(
  scene: Scene,
  world: World,
  config: WorldAndSceneConfig,
  trajectoryPlan: TrajectoryPlan[],
): void {
  const existingIds = new Set(scene.objects.map((obj) => obj.id));

  for (const entry of trajectoryPlan) {
    if (existingIds.has(entry.pathId)) continue;
    const trajectoryTarget = parseTrajectoryId(entry.pathId);
    if (!trajectoryTarget) {
      throw new Error(`Unrecognized trajectory id: ${entry.pathId}`);
    }

    const targetId = trajectoryTarget.targetId;
    const body = getById(world.entityStates, targetId, "Entity state");
    const color = getTrajectoryColor(config, targetId);
    scene.objects.push(
      createPolylineSceneObject(entry.pathId, body.position, color),
    );
    existingIds.add(entry.pathId);
  }
}

function bindTrajectoryPlanToScene(
  scene: Scene,
  plan: TrajectoryPlan[],
): Trajectory[] {
  const trajectories: Trajectory[] = [];
  const sceneObjectIndex: Record<string, number> = {};
  for (let i = 0; i < scene.objects.length; i++) {
    sceneObjectIndex[scene.objects[i].id] = i;
  }

  for (const entry of plan) {
    const sceneObject = scene.objects[sceneObjectIndex[entry.pathId]] as
      | PolylineSceneObject
      | undefined;
    if (!sceneObject) {
      throw new Error(`Trajectory scene object not found: ${entry.pathId}`);
    }
    sceneObject.mesh.points = Array.from({ length: entry.capacity }).map(() =>
      vec3.zero(),
    );
    trajectories.push({
      intervalMillis: entry.intervalMillis,
      remainingMillis: 0,
      sceneObject,
    });
  }

  return trajectories;
}

function updateTrajectories(
  dtMillis: number,
  trajectories: Trajectory[],
): void {
  for (let i = 0; i < trajectories.length; i++) {
    const trajectory = trajectories[i];
    if (trajectory.remainingMillis <= 0) {
      const obj = trajectory.sceneObject;
      const points = obj.mesh.points;
      if (obj.count < points.length) obj.count++;
      obj.tail = (obj.tail + 1) % points.length;
      vec3.copyInto(points[obj.tail], obj.position);
      trajectory.remainingMillis += trajectory.intervalMillis;
    }
    trajectory.remainingMillis -= dtMillis;
  }
}

function createVelocitySegments(): SegmentPlugin {
  const velocityScratch: Vec3 = vec3.zero();
  const forwardSegment: WorldSegment = {
    start: vec3.zero(),
    end: vec3.zero(),
    cssColor: "lime",
    lineWidth: 4,
  };
  const backwardSegment: WorldSegment = {
    start: vec3.zero(),
    end: vec3.zero(),
    cssColor: "red",
    lineWidth: 4,
  };

  return {
    appendSegments: (into, { mainFocus }) => {
      if (
        !mutateFocusVelocitySegments(
          mainFocus.controlledBody,
          velocityScratch,
          forwardSegment,
          backwardSegment,
        )
      ) {
        return;
      }
      into.push(forwardSegment, backwardSegment);
    },
  };
}

function mutateFocusVelocitySegments(
  body: ControlledBody,
  velocityScratch: Vec3,
  forward: WorldSegment,
  backward: WorldSegment,
): boolean {
  vec3.copyInto(velocityScratch, body.velocity);
  const speedSq = vec3.lengthSq(velocityScratch);
  if (speedSq <= 0.000001) return false;

  const dir = vec3.normalizeInto(velocityScratch);
  const center = body.position;
  vec3.scaledAddInto(forward.start, center, dir, 7);
  vec3.scaledAddInto(forward.end, center, dir, 500_000);
  vec3.scaledAddInto(backward.start, center, dir, -7);
  vec3.scaledAddInto(backward.end, center, dir, -500_000);
  return true;
}

function updateTopViewFrame({ frame, mainFocus }: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.right, controlledBodyFrame.right);
  vec3.scaleInto(frame.forward, -1, controlledBodyFrame.up);
  vec3.copyInto(frame.up, controlledBodyFrame.forward);
}

function updateLeftViewFrame({
  frame,
  mainFocus,
}: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.forward, controlledBodyFrame.right);
  vec3.scaleInto(frame.forward, -1, frame.forward);
  vec3.copyInto(frame.right, controlledBodyFrame.forward);
}

function updateRightViewFrame({
  frame,
  mainFocus,
}: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.forward, controlledBodyFrame.right);
  vec3.copyInto(frame.right, controlledBodyFrame.forward);
  vec3.scaleInto(frame.right, -1, frame.right);
}

function updateRearViewFrame({
  frame,
  mainFocus,
}: ViewFrameUpdateParams): void {
  const controlledBodyFrame = mainFocus.controlledBody.frame;
  vec3.copyInto(frame.up, controlledBodyFrame.up);
  vec3.copyInto(frame.right, controlledBodyFrame.right);
  vec3.copyInto(frame.forward, controlledBodyFrame.forward);
  vec3.scaleInto(frame.forward, -1, frame.forward);
}

function getLabelCandidate(
  candidatesById: Map<string, MutableSceneLabelCandidate>,
  id: string,
): MutableSceneLabelCandidate {
  let candidate = candidatesById.get(id);
  if (!candidate) {
    candidate = {
      id,
      anchor: vec3.zero(),
      lines: [],
    };
    candidatesById.set(id, candidate);
  }
  return candidate;
}

function writeLabelLines(
  into: string[],
  labelMode: "full" | "nameOnly",
  displayName: string,
  distance: number,
  speed: number,
): void {
  into[0] = displayName;
  if (labelMode === "nameOnly") {
    into.length = 1;
    return;
  }
  into[1] = "d=".concat(formatDistance(distance));
  into[2] = "v=".concat(formatSpeed(speed));
  into.length = 3;
}

function getDisplayName(displayNamesById: Map<string, string>, id: string) {
  let displayName = displayNamesById.get(id);
  if (!displayName) {
    displayName = formatDisplayNameFromId(id);
    displayNamesById.set(id, displayName);
  }
  return displayName;
}

function formatDisplayNameFromId(id: string): string {
  const separatorIndex = id.lastIndexOf(":");
  const raw = separatorIndex >= 0 ? id.slice(separatorIndex + 1) : id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function trajectoryIdForShip(shipId: string): string {
  return "traj:ship:".concat(shipId);
}

function trajectoryIdForPlanet(planetId: string): string {
  return "traj:planet:".concat(planetId);
}

function parseTrajectoryId(
  id: string,
): { kind: "ship" | "planet"; targetId: string } | null {
  if (id.startsWith("traj:ship:")) {
    return { kind: "ship", targetId: id.slice("traj:ship:".length) };
  }
  if (id.startsWith("traj:planet:")) {
    return { kind: "planet", targetId: id.slice("traj:planet:".length) };
  }
  return null;
}

function getTrajectoryPlanetConfigs(configs: EntityConfig[]): {
  centralEntityId: string;
  id: string;
  orbit: KeplerianOrbit;
}[] {
  const planetConfigs: {
    centralEntityId: string;
    id: string;
    orbit: KeplerianOrbit;
  }[] = [];
  for (const entity of configs) {
    const state = entity.components.state;
    if (!state || state.kind !== "keplerian") continue;
    if (entity.components.lightEmitter) continue;

    planetConfigs.push({
      centralEntityId: state.centralEntityId,
      id: entity.id,
      orbit: state.orbit,
    });
  }

  return planetConfigs;
}

function getTrajectoryColor(config: WorldAndSceneConfig, id: string): RGB {
  const renderable = config.entities.find((item) => item.id === id)?.components
    .renderable;
  if (!renderable) {
    throw new Error(`Entity render config not found: ${id}`);
  }
  return renderable.color;
}

function createPolylineSceneObject(
  id: string,
  position: Vec3,
  color: RGB,
): PolylineSceneObject {
  return {
    id,
    kind: "polyline",
    mesh: { points: [], faces: [] },
    position,
    orientation: mat3.identity,
    color,
    lineWidth: 2,
    wireframeOnly: true,
    applyTransform: false,
    backFaceCulling: false,
    count: 0,
    tail: -1,
  };
}

function getById<T extends { id: string }>(
  list: T[],
  id: string,
  typeName: string,
): T {
  const obj = list.find((item) => item.id === id);
  if (!obj) {
    throw new Error(`${typeName} not found: ${id}`);
  }
  return obj;
}

function orbitalEllipseLength(orbit: KeplerianOrbit): number {
  const a = orbit.semiMajorAxis;
  const e = orbit.eccentricity;

  if (e < 0 || e >= 1) {
    throw new Error(
      "Eccentricity must be in [0, 1) for a bound elliptical orbit.",
    );
  }

  const b = a * Math.sqrt(1 - e * e);
  const aMinusB = a - b;
  const aPlusB = a + b;
  const hTimes3 = (3 * (aMinusB * aMinusB)) / (aPlusB * aPlusB);

  return Math.PI * aPlusB * (1 + hTimes3 / (10 + Math.sqrt(4 - hTimes3)));
}
