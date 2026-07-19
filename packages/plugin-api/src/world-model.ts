import type { EntityConfig, EntityId } from "@solitude/engine/world";
import type { ExternalPluginCapabilityRegistry } from "./capabilities";

export type { EntityConfig as ExternalEntityConfig };

export interface ExternalWorldModelRegistry {
  addEntities: (entities: EntityConfig[]) => void;
  setMainFocusEntityId: (id: EntityId) => void;
}

export interface ExternalWorldModelContext {
  capabilityRegistry: ExternalPluginCapabilityRegistry;
}

export interface ExternalWorldModelPlugin {
  contributeWorldModel: (
    registry: ExternalWorldModelRegistry,
    context: ExternalWorldModelContext,
  ) => void;
}
