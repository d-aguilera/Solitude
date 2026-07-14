import type { ExternalRenderTextureSourceCatalog } from "@solitude/plugin-api/render";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";

export function createSolarSystemMaterialTextureSources(
  pluginModuleUrl: string,
): ExternalRenderTextureSourceCatalog {
  return {
    [earthCloudTextureId]: new URL(
      "./assets/earth-blue-marble-clouds-2048.jpg",
      pluginModuleUrl,
    ).href,
    [earthDayTextureId]: new URL(
      "./assets/earth-blue-marble-land-ocean-ice-8192.jpg",
      pluginModuleUrl,
    ).href,
    [moonDayTextureId]: new URL(
      "./assets/moon-lro-lroc-color-4096.jpg",
      pluginModuleUrl,
    ).href,
  };
}
