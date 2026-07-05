import type { GamePlugin, RenderTextureSourceCatalog } from "./pluginPorts";

export function collectPluginTextureSources(
  plugins: readonly GamePlugin[],
  explicitTextureSources: RenderTextureSourceCatalog = {},
): RenderTextureSourceCatalog {
  const textureSources: Record<string, string> = {};
  const providersByTextureId = new Map<string, string>();

  for (const plugin of plugins) {
    const pluginTextureSources = plugin.renderAssets?.textureSources;
    if (!pluginTextureSources) continue;

    for (const [textureId, source] of Object.entries(pluginTextureSources)) {
      const existingSource = textureSources[textureId];
      if (existingSource !== undefined && existingSource !== source) {
        throw new Error(
          `Texture source "${textureId}" is provided by both ` +
            `"${providersByTextureId.get(textureId)}" and "${plugin.id}"`,
        );
      }
      textureSources[textureId] = source;
      providersByTextureId.set(textureId, plugin.id);
    }
  }

  return { ...textureSources, ...explicitTextureSources };
}
