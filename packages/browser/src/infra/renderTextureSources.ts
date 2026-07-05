import type { PluginCapabilityRegistry } from "@solitude/engine/plugin";

export const renderTextureSourcesCapability =
  "solitude.render.textureSources.v1";

export type RenderTextureSourceCatalog = Readonly<Record<string, string>>;

interface RenderTextureSourceProvider {
  textureSources: RenderTextureSourceCatalog;
}

export function collectRenderTextureSources(
  capabilityRegistry: PluginCapabilityRegistry,
): RenderTextureSourceCatalog {
  const textureSources: Record<string, string> = {};
  const providers = capabilityRegistry
    .getAll(renderTextureSourcesCapability)
    .filter(isRenderTextureSourceProvider);

  for (const provider of providers) {
    for (const [textureId, source] of Object.entries(provider.textureSources)) {
      const existingSource = textureSources[textureId];
      if (existingSource !== undefined && existingSource !== source) {
        throw new Error(
          `Texture source "${textureId}" is provided by multiple render texture source providers`,
        );
      }
      textureSources[textureId] = source;
    }
  }

  return textureSources;
}

function isRenderTextureSourceProvider(
  value: unknown,
): value is RenderTextureSourceProvider {
  const candidate = value as Partial<RenderTextureSourceProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.textureSources === "object" &&
    candidate.textureSources !== null
  );
}
