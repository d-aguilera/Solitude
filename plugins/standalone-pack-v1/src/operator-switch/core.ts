import type {
  ExternalEntityId,
  ExternalFocusContext,
  ExternalWorld,
} from "@solitude/plugin-api/world";

export function createOperatorSwitchController(
  targetEntityIds: readonly ExternalEntityId[],
): {
  applyPendingSwap: (
    world: ExternalWorld,
    mainFocus: ExternalFocusContext,
    focusEntity: (id: ExternalEntityId) => void,
  ) => boolean;
  requestSwap: () => void;
  validateTargets: (world: ExternalWorld) => void;
} {
  let swapRequested = false;
  let targetsValidated = false;

  return {
    applyPendingSwap: (world, mainFocus, focusEntity) => {
      if (!targetsValidated) {
        validateFocusTargets(world, targetEntityIds);
        targetsValidated = true;
      }
      if (!swapRequested) return false;
      swapRequested = false;
      focusEntity(getNextFocusTarget(targetEntityIds, mainFocus.entityId));
      return true;
    },
    requestSwap: () => {
      swapRequested = true;
    },
    validateTargets: (world) => validateFocusTargets(world, targetEntityIds),
  };
}

function getNextFocusTarget(
  targetEntityIds: readonly ExternalEntityId[],
  currentEntityId: ExternalEntityId,
): ExternalEntityId {
  if (targetEntityIds.length === 0) {
    throw new Error(
      "Operator switch plugin requires at least one focus target",
    );
  }
  const currentIndex = targetEntityIds.indexOf(currentEntityId);
  if (currentIndex < 0) return targetEntityIds[0];
  return targetEntityIds[(currentIndex + 1) % targetEntityIds.length];
}

function validateFocusTargets(
  world: ExternalWorld,
  targetEntityIds: readonly ExternalEntityId[],
): void {
  if (targetEntityIds.length === 0) {
    throw new Error(
      "Operator switch plugin requires at least one focus target",
    );
  }
  for (const targetEntityId of targetEntityIds) {
    const found = world.controllableBodies.some(
      (body) => body.id === targetEntityId,
    );
    if (!found) {
      throw new Error(
        `Operator switch focus target is not controllable: ${targetEntityId}`,
      );
    }
  }
}
