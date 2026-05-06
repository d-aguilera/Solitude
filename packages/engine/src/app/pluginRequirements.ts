import type { World } from "../domain/domainPorts";
import type { FocusCapabilityRequirement, GamePlugin } from "./pluginPorts";
import type { FocusContext } from "./runtimePorts";

export interface PluginRequirementValidationParams {
  mainFocus: FocusContext;
  plugins: readonly GamePlugin[];
  world: World;
}

export function validatePluginRequirements({
  mainFocus,
  plugins,
  world,
}: PluginRequirementValidationParams): void {
  for (const plugin of plugins) {
    const focusRequirements = plugin.requirements?.mainFocus;
    if (!focusRequirements) continue;
    for (const capability of focusRequirements) {
      if (hasFocusCapability(world, mainFocus, capability)) continue;
      throw new Error(
        `Plugin "${plugin.id}" requires main focus capability "${capability}" on entity "${mainFocus.entityId}"`,
      );
    }
  }
}

function hasFocusCapability(
  world: World,
  mainFocus: FocusContext,
  capability: FocusCapabilityRequirement,
): boolean {
  const focusedBody = mainFocus.controlledBody;
  switch (capability) {
    case "angularVelocity":
      return "angularVelocity" in focusedBody;
    case "collisionSphere":
      return hasCapabilityRecord(world.collisionSpheres, mainFocus.entityId);
    case "controlledBody":
      return hasCapabilityRecord(world.controllableBodies, mainFocus.entityId);
    case "gravityMass":
      return hasCapabilityRecord(world.gravityMasses, mainFocus.entityId);
    case "lightEmitter":
      return hasCapabilityRecord(world.lightEmitters, mainFocus.entityId);
    case "localFrame":
      return "frame" in focusedBody;
    case "motionState":
      return hasCapabilityRecord(world.entityStates, mainFocus.entityId);
  }
}

function hasCapabilityRecord(
  records: readonly { id: string }[],
  entityId: string,
): boolean {
  for (const record of records) {
    if (record.id === entityId) return true;
  }
  return false;
}
