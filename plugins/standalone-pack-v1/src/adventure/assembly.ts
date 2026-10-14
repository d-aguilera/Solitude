import {
  keyboardInputCapability,
  type ExternalKeyboardInputProvider,
} from "@solitude/plugin-api/input";
import type { ExternalPluginAssemblyContext } from "@solitude/plugin-api/module";
import {
  getSpacecraftPropulsionResolvers,
  type ExternalSpacecraftPropulsionResolver,
} from "@solitude/plugin-api/spacecraft";

/** The session must also reject a missing final policy, whose validator cannot run. */
export function validateAdventureSessionAssembly({
  contributors,
}: ExternalPluginAssemblyContext): void {
  const final = contributors.filter((c) => c.id === "adventureFinalPolicy");
  if (
    final.length !== 1 ||
    ![
      "loop.updateLoopState",
      "loop.afterFrame",
      "simulation.beforeVehicleDynamics",
    ].every((hook) => final[0].hooks.includes(hook))
  )
    throw new Error(
      "Adventure session requires one active adventureFinalPolicy",
    );
}

/** Validate actual execution lists, never pack position or factory declarations. */
export function createAdventureAssemblyValidator(
  keyboard: ExternalKeyboardInputProvider,
  resolver: ExternalSpacecraftPropulsionResolver,
): (context: ExternalPluginAssemblyContext) => void {
  return ({ contributors, capabilityRegistry }) => {
    const ids = new Set<string>();
    for (const contributor of contributors) {
      if (ids.has(contributor.id))
        throw new Error(`Duplicate assembly contributor "${contributor.id}"`);
      ids.add(contributor.id);
    }
    const owners = (hook: string) =>
      contributors.filter((c) => c.hooks.includes(hook));
    const requireEdge = (hook: string, id: string, edge: "first" | "last") => {
      const list = owners(hook);
      const actual = edge === "first" ? list[0] : list[list.length - 1];
      if (actual?.id !== id)
        throw new Error(
          `${hook}: "${id}" must be ${edge}; found "${actual?.id ?? "none"}"`,
        );
    };
    requireEdge("loop.updateLoopState", "standaloneSession", "first");
    requireEdge("loop.updateLoopState", "adventureFinalPolicy", "last");
    requireEdge(
      "simulation.beforeVehicleDynamics",
      "adventureFinalPolicy",
      "last",
    );
    requireEdge("loop.afterFrame", "standaloneSession", "first");
    requireEdge("loop.afterFrame", "adventureFinalPolicy", "last");

    const providers = contributors.flatMap((c) =>
      c.capabilities
        .filter((p) => p.id === keyboardInputCapability)
        .map((p) => ({
          owner: c.id,
          value: p.value as ExternalKeyboardInputProvider,
        })),
    );
    if (providers[providers.length - 1]?.value !== keyboard)
      throw new Error(
        `Adventure keyboard guard must be last provider (first dispatched); found "${providers[providers.length - 1]?.owner ?? "none"}"`,
      );
    const bindings = new Map<string, { action: string; owner: string }>();
    for (const { owner, value } of providers) {
      for (const [code, action] of Object.entries(value.keyMap ?? {})) {
        const existing = bindings.get(code);
        if (existing && existing.action !== action)
          throw new Error(
            `Keyboard binding ${code}: "${owner}" overrides "${existing.owner}" (${existing.action} → ${action})`,
          );
        bindings.set(code, { action, owner });
      }
    }
    const resolvers = getSpacecraftPropulsionResolvers(capabilityRegistry);
    if (resolvers[resolvers.length - 1] !== resolver)
      throw new Error("Adventure propulsion resolver must be last");

    const dynamics = owners("simulation.updateVehicleDynamics");
    if (dynamics.length !== 1 || dynamics[0].id !== "spacecraftOperator")
      throw new Error(
        `Adventure requires only spacecraftOperator vehicle dynamics; found ${dynamics.map((c) => c.id).join(", ") || "none"}`,
      );
    for (const c of contributors) {
      for (const hook of c.hooks) {
        if (hook.startsWith("controls.") && c.id !== "autopilot")
          throw new Error(
            `Unsupported adventure control contributor "${c.id}" (${hook})`,
          );
        if (
          hook.startsWith("simulation.") &&
          hook !== "simulation.beforeVehicleDynamics" &&
          hook !== "simulation.updateVehicleDynamics"
        )
          throw new Error(
            `Unsupported adventure simulation contributor "${c.id}" (${hook})`,
          );
        if (hook === "loop.getInitialSimTimeMillis")
          throw new Error(
            `Unsupported adventure initial clock contributor "${c.id}"`,
          );
      }
    }
  };
}
