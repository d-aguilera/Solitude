import earthCloudsUrl from "./assets/textures/earth-blue-marble-clouds-2048.jpg";
import earthBlueMarbleUrl from "./assets/textures/earth-blue-marble-land-ocean-ice-8192.jpg";
import moonLroColorUrl from "./assets/textures/moon-lro-lroc-color-4096.jpg";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";

export const solitudeTextureSources = {
  [earthCloudTextureId]: earthCloudsUrl,
  [earthDayTextureId]: earthBlueMarbleUrl,
  [moonDayTextureId]: moonLroColorUrl,
} as const;
