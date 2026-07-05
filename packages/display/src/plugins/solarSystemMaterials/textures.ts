import earthCloudsUrl from "./assets/earth-blue-marble-clouds-2048.jpg";
import earthBlueMarbleUrl from "./assets/earth-blue-marble-land-ocean-ice-8192.jpg";
import moonLroColorUrl from "./assets/moon-lro-lroc-color-4096.jpg";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";

export const solarSystemMaterialTextureSources = {
  [earthCloudTextureId]: earthCloudsUrl,
  [earthDayTextureId]: earthBlueMarbleUrl,
  [moonDayTextureId]: moonLroColorUrl,
} as const;
