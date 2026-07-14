import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
  type ControllableEntityProvider,
  type DirectControllableEntityPlacement,
} from "@solitude/engine/controllable-entities";
import type { ExternalPluginCapabilityProvider } from "./capabilities";

export { controllableEntityProviderCapability, isControllableEntityProvider };
export type {
  ControllableEntityProvider as ExternalControllableEntityProvider,
  DirectControllableEntityPlacement as ExternalDirectControllableEntityPlacement,
};

export function createControllableEntityProviderCapability(
  provider: ControllableEntityProvider,
): ExternalPluginCapabilityProvider {
  return { id: controllableEntityProviderCapability, value: provider };
}
