import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
  type CelestialBody,
  type CelestialBodyProvider,
} from "@solitude/engine/celestial-bodies";
import type { ExternalPluginCapabilityProvider } from "./capabilities";

export { celestialBodyProviderCapability, isCelestialBodyProvider };
export type {
  CelestialBody as ExternalCelestialBody,
  CelestialBodyProvider as ExternalCelestialBodyProvider,
};

export function createCelestialBodyProviderCapability(
  provider: CelestialBodyProvider,
): ExternalPluginCapabilityProvider {
  return { id: celestialBodyProviderCapability, value: provider };
}
