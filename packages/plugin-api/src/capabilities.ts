import type {
  ExternalEntityId,
  ExternalEntityNameProvider,
  ExternalHudPanelProvider,
  ExternalKeyboardInputProvider,
  ExternalMultiplayerSessionProvider,
  ExternalPluginCapabilityProvider,
  ExternalPluginCapabilityRegistry,
  ExternalPresentationFrameProvider,
  ExternalRenderTextureSourceCatalog,
  ExternalRenderTextureSourcesProvider,
  ExternalSpacecraftOperatorTelemetry,
  ExternalSpacecraftOperatorTelemetryProvider,
} from "./plugin";

export const keyboardInputCapability = "solitude.keyboardInput.v1";
export const entityNameProviderCapability = "solitude.entityNameProvider.v1";
export const hudPanelCapability = "solitude.hud.panel.v1";
export const multiplayerSessionCapability = "solitude.multiplayer.session.v1";
export const presentationFrameCapability =
  "solitude.browser.presentationFrame.v1";
export const renderTextureSourcesCapability =
  "solitude.render.textureSources.v1";
export const spacecraftOperatorTelemetryCapability =
  "spacecraft.operatorTelemetry.v1";

export function createEntityNameProvider(
  provider: ExternalEntityNameProvider,
): ExternalPluginCapabilityProvider {
  return { id: entityNameProviderCapability, value: provider };
}

export function formatEntityName(
  capabilityRegistry: ExternalPluginCapabilityRegistry,
  entityId: ExternalEntityId,
  explicitDisplayName: string | undefined,
): string {
  if (explicitDisplayName) return explicitDisplayName;
  for (const value of capabilityRegistry.getAll(entityNameProviderCapability)) {
    if (!isEntityNameProvider(value)) continue;
    const formatted = value.formatEntityName(entityId);
    if (formatted != null) return formatted;
  }
  const separatorIndex = entityId.lastIndexOf(":");
  const raw =
    separatorIndex >= 0 ? entityId.slice(separatorIndex + 1) : entityId;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isEntityNameProvider(
  value: unknown,
): value is ExternalEntityNameProvider {
  const candidate = value as Partial<ExternalEntityNameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.formatEntityName === "function"
  );
}

export function createKeyboardInputCapability(
  provider: ExternalKeyboardInputProvider,
): ExternalPluginCapabilityProvider {
  return { id: keyboardInputCapability, value: provider };
}

export function createHudPanelCapability(
  provider: ExternalHudPanelProvider,
): ExternalPluginCapabilityProvider {
  return { id: hudPanelCapability, value: provider };
}

export function isHudPanelProvider(
  value: unknown,
): value is ExternalHudPanelProvider {
  const candidate = value as Partial<ExternalHudPanelProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.writeHud === "function"
  );
}

export function createPresentationFrameCapability(
  provider: ExternalPresentationFrameProvider,
): ExternalPluginCapabilityProvider {
  return { id: presentationFrameCapability, value: provider };
}

export function isPresentationFrameProvider(
  value: unknown,
): value is ExternalPresentationFrameProvider {
  const candidate = value as Partial<ExternalPresentationFrameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.updatePresentationFrame === "function"
  );
}

export function createMultiplayerSessionCapability(
  provider: ExternalMultiplayerSessionProvider,
): ExternalPluginCapabilityProvider {
  return { id: multiplayerSessionCapability, value: provider };
}

export function isMultiplayerSessionProvider(
  value: unknown,
): value is ExternalMultiplayerSessionProvider {
  const candidate = value as Partial<ExternalMultiplayerSessionProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.getEntityId === "function" &&
    typeof candidate.getGameId === "function"
  );
}

export function createSpacecraftOperatorTelemetryProvider(
  telemetry: ExternalSpacecraftOperatorTelemetry,
): ExternalPluginCapabilityProvider {
  return {
    id: spacecraftOperatorTelemetryCapability,
    value: { telemetry } satisfies ExternalSpacecraftOperatorTelemetryProvider,
  };
}

export function isSpacecraftOperatorTelemetryProvider(
  value: unknown,
): value is ExternalSpacecraftOperatorTelemetryProvider {
  const candidate =
    value as Partial<ExternalSpacecraftOperatorTelemetryProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.telemetry === "object" &&
    candidate.telemetry !== null &&
    typeof candidate.telemetry.currentThrustLevel === "number" &&
    typeof candidate.telemetry.currentRcsLevel === "number"
  );
}

export function createRenderTextureSourcesCapability(
  textureSources: ExternalRenderTextureSourceCatalog,
): ExternalPluginCapabilityProvider {
  return {
    id: renderTextureSourcesCapability,
    value: { textureSources } satisfies ExternalRenderTextureSourcesProvider,
  };
}
