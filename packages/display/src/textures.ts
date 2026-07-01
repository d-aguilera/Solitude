import { earthDayTextureId } from "@solitude/sim/textures";
import earthBlueMarbleUrl from "./assets/textures/earth-blue-marble-land-ocean-ice-8192.jpg";

export const solitudeTextureSources = {
  [earthDayTextureId]: earthBlueMarbleUrl,
} as const;
