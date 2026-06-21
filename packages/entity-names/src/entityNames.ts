import type {
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";

export interface EntityNameProvider {
  formatEntityName: (entityId: string) => string | null;
}

export const entityNameProviderCapability = "solitude.entityNameProvider.v1";

export function createEntityNameProvider(
  provider: EntityNameProvider,
): PluginCapabilityProvider {
  return {
    id: entityNameProviderCapability,
    value: provider,
  };
}

export function formatEntityName(
  capabilityRegistry: PluginCapabilityRegistry,
  entityId: string,
  explicitDisplayName: string | undefined,
): string {
  if (explicitDisplayName) return explicitDisplayName;

  for (const provider of capabilityRegistry.getAll(
    entityNameProviderCapability,
  )) {
    if (!isEntityNameProvider(provider)) continue;
    const formatted = provider.formatEntityName(entityId);
    if (formatted != null) return formatted;
  }

  return displayNameFromEntityId(entityId);
}

function isEntityNameProvider(value: unknown): value is EntityNameProvider {
  const candidate = value as Partial<EntityNameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.formatEntityName === "function"
  );
}

function displayNameFromEntityId(id: string): string {
  const separatorIndex = id.lastIndexOf(":");
  const raw = separatorIndex >= 0 ? id.slice(separatorIndex + 1) : id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
