import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import {
  createMultiplayerSessionPlugin,
  multiplayerSessionCapability,
} from "../multiplayerSession";

describe("multiplayer session capability", () => {
  it("publishes live identity accessors for external presentation plugins", () => {
    let entityId = "ship:blue";
    let gameId = "game:1";
    const plugin = createMultiplayerSessionPlugin({
      getEntityId: () => entityId,
      getGameId: () => gameId,
    });
    const registry = createPluginCapabilityRegistry([plugin]);
    const provider = registry.getAll(multiplayerSessionCapability)[0] as {
      getEntityId: () => string;
      getGameId: () => string;
    };

    entityId = "ship:red";
    gameId = "game:2";

    expect(provider.getEntityId()).toBe("ship:red");
    expect(provider.getGameId()).toBe("game:2");
  });
});
