export { updateFocusContext } from "./app/focus";
export { createTickHandler } from "./app/game";
export {
  applyAxialSpin,
  applyControlledBodyRotation,
  applyGravity,
  createPhysicsWorkspace,
} from "./app/physics";
export type { PhysicsWorkspace } from "./app/physics";
export { createPluginCapabilityRegistry } from "./app/pluginCapabilities";
export { validatePluginRequirements } from "./app/pluginRequirements";
export type { PluginRequirementValidationParams } from "./app/pluginRequirements";
export type {
  FocusContext,
  TickCallback,
  TickParams,
  WorldAndScene,
} from "./app/runtimePorts";
export { parameters } from "./global/parameters";
export { profiler, profilerController } from "./global/profiling";
export { createHeadlessLoop } from "./infra/headlessGameLoop";
export type {
  HeadlessLoop,
  HeadlessLoopOptions,
} from "./infra/headlessGameLoop";
export {
  NewtonianGravityEngine,
  createNewtonianGravityWorkspace,
} from "./infra/NewtonianGravityEngine";
export type { NewtonianGravityWorkspace } from "./infra/NewtonianGravityEngine";
