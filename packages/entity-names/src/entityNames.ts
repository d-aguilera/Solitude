export interface EntityNameProvider {
  formatEntityName: (entityId: string) => string | null;
}

export interface EntityNameCapabilityProvider {
  id: string;
  value: unknown;
}

export interface EntityNameCapabilityRegistry {
  getAll: (id: string) => readonly unknown[];
}

export const entityNameProviderCapability = "solitude.entityNameProvider.v1";

export function createEntityNameProvider(
  provider: EntityNameProvider,
): EntityNameCapabilityProvider {
  return {
    id: entityNameProviderCapability,
    value: provider,
  };
}

export function formatEntityName(
  capabilityRegistry: EntityNameCapabilityRegistry,
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
