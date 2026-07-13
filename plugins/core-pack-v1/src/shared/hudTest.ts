import {
  hudPanelCapability,
  isHudPanelProvider,
} from "@solitude/plugin-api/capabilities";
import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalControlledBody,
  ExternalEntityCollisionSphere,
  ExternalEntityMotionState,
  ExternalGravityMass,
  ExternalHudColumnId,
  ExternalHudContext,
  ExternalHudGrid,
  ExternalHudPanelProvider,
  ExternalPlugin,
  ExternalPluginCapabilityProvider,
  ExternalWorld,
} from "@solitude/plugin-api/plugin";
import { computeStandardGravitationalParameter } from "@solitude/plugin-api/world";

interface TestHudLine {
  key: string;
  text: string;
}

export interface TestHudGrid extends ExternalHudGrid {
  columns: Record<ExternalHudColumnId, TestHudLine[]>;
}

export interface TestWorld extends ExternalWorld {
  collisionSpheres: ExternalEntityCollisionSphere[];
  controllableBodies: ExternalControlledBody[];
  entityStates: ExternalEntityMotionState[];
  gravityMasses: ExternalGravityMass[];
}

export function createTestHudGrid(): TestHudGrid {
  const columns: Record<ExternalHudColumnId, TestHudLine[]> = {
    center: [],
    left: [],
    leftCenter: [],
    right: [],
    rightCenter: [],
  };
  return {
    columns,
    addLine: (column, key, text) => {
      const lines = columns[column];
      const existing = lines.find((line) => line.key === key);
      if (existing) {
        existing.text = text;
      } else {
        lines.push({ key, text });
      }
    },
    appendLine: (column, key, text, separator) => {
      const lines = columns[column];
      const existing = lines.find((line) => line.key === key);
      if (existing) {
        existing.text = existing.text.concat(separator, text);
      } else {
        lines.push({ key, text });
      }
    },
  };
}

export function columnTexts(
  grid: TestHudGrid,
  column: ExternalHudColumnId,
): string[] {
  return grid.columns[column].map((line) => line.text);
}

export function createTestWorldAndBody(): {
  body: ExternalControlledBody;
  world: TestWorld;
} {
  const planetId = "planet:earth";
  const bodyId = "ship:test";
  const planetMass = 5.972e24;
  const planetRadius = 6_371_000;
  const orbitRadius = planetRadius + 400_000;
  const circularSpeed = Math.sqrt(
    computeStandardGravitationalParameter(planetMass) / orbitRadius,
  );
  const body: ExternalControlledBody = {
    frame: {
      forward: vec3.create(0, 1, 0),
      right: vec3.create(1, 0, 0),
      up: vec3.create(0, 0, 1),
    },
    id: bodyId,
    position: vec3.create(orbitRadius, 0, 0),
    velocity: vec3.create(0, circularSpeed, 0),
  };
  const planet: ExternalEntityMotionState = {
    id: planetId,
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
  return {
    body,
    world: {
      collisionSpheres: [{ id: planetId, radius: planetRadius, state: planet }],
      controllableBodies: [body],
      entityStates: [body, planet],
      gravityMasses: [
        { id: bodyId, mass: 1, state: body },
        { id: planetId, mass: planetMass, state: planet },
      ],
    },
  };
}

export function createTestHudContext(
  world: ExternalWorld,
  body: ExternalControlledBody,
  capabilities: readonly ExternalPluginCapabilityProvider[] = [],
): ExternalHudContext {
  return {
    capabilityRegistry: {
      getAll: (id) =>
        capabilities
          .filter((capability) => capability.id === id)
          .map((capability) => capability.value),
    },
    controlInput: {},
    mainFocus: { controlledBody: body, entityId: body.id },
    nowMs: 1234,
    simTimeMillis: 65_000,
    world,
  };
}

export function getHudPanel(plugin: ExternalPlugin): ExternalHudPanelProvider {
  const capability = plugin.capabilities?.find(
    (candidate) =>
      candidate.id === hudPanelCapability &&
      isHudPanelProvider(candidate.value),
  );
  if (!capability || !isHudPanelProvider(capability.value)) {
    throw new Error(`Plugin ${plugin.id} did not provide a HUD panel`);
  }
  return capability.value;
}
