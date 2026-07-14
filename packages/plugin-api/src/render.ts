import type { ExternalPluginCapabilityProvider } from "./capabilities";

export interface ExternalRgb {
  r: number;
  g: number;
  b: number;
}

export type ExternalRenderMaterial =
  | { kind: "solidColor" }
  | {
      kind: "sphericalTexture";
      textureId: string;
      longitudeOffsetRad?: number;
      cloudTextureId?: string;
      cloudOpacity?: number;
      cloudScale?: number;
      atmosphere?: {
        color: ExternalRgb;
        opacity: number;
        scale: number;
      };
    };

export type ExternalRenderTextureSourceCatalog = Readonly<
  Record<string, string>
>;

export interface ExternalRenderTextureSourcesProvider {
  textureSources: ExternalRenderTextureSourceCatalog;
}

export const renderTextureSourcesCapability =
  "solitude.render.textureSources.v1";

export function createRenderTextureSourcesCapability(
  textureSources: ExternalRenderTextureSourceCatalog,
): ExternalPluginCapabilityProvider {
  return {
    id: renderTextureSourcesCapability,
    value: { textureSources } satisfies ExternalRenderTextureSourcesProvider,
  };
}
