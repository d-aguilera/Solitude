import type { EntityId, World } from "../domain/domainPorts";
import type { FocusContext } from "./runtimePorts";

export function updateFocusContext(
  world: World,
  mainFocus: FocusContext,
  entityId: EntityId,
): void {
  const controlledBody = findControlledBody(world, entityId);
  mainFocus.entityId = entityId;
  mainFocus.controlledBody = controlledBody;
}

function findControlledBody(world: World, entityId: EntityId) {
  for (const body of world.controllableBodies) {
    if (body.id === entityId) return body;
  }
  throw new Error(`Controlled entity not found: ${entityId}`);
}
