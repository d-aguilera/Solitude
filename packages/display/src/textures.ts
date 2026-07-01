import { earthCloudTextureId, earthDayTextureId } from "@solitude/sim/textures";
import earthCloudsUrl from "./assets/textures/earth-blue-marble-clouds-2048.jpg";
import earthBlueMarbleUrl from "./assets/textures/earth-blue-marble-land-ocean-ice-8192.jpg";

export const solitudeTextureSources = {
  [earthCloudTextureId]: earthCloudsUrl,
  [earthDayTextureId]: earthBlueMarbleUrl,
} as const;
