import type { ControlInput } from "@solitude/engine/plugin";
import type { EntityId } from "@solitude/engine/world";
import type {
  InputMessage,
  SolitudeClientId,
  SolitudeGameId,
} from "@solitude/protocol/protocol";
import type { SolitudeServerGame } from "@solitude/server/game";
import { compactSnapshotEntities } from "@solitude/server/snapshot";
import type { SolitudeInProcessTransport } from "@solitude/server/transport";
import { resolve } from "node:path";
import { bench, describe } from "vitest";
import {
  createDefaultMultiplayerSimulationPlugins,
  createDefaultMultiplayerSpacecraftEntity,
  createDefaultMultiplayerSpawnProviders,
  createDefaultSolitudeInProcessTransport,
} from "../composition";
import { createSolitudeServerGame } from "../runtime";
import { loadDefaultMultiplayerContentPluginSet } from "../serverPlugins";

const FIXED_STEP_MILLIS = 1000 / 60;
const serverPluginSetPath = resolve(
  import.meta.dirname,
  "../../../../dist/server/plugins/plugin-set.json",
);
const contentPlugins = await loadDefaultMultiplayerContentPluginSet({
  SOLITUDE_SERVER_PLUGIN_SET: serverPluginSetPath,
});
const spawnProviders = createDefaultMultiplayerSpawnProviders(
  contentPlugins,
  {},
);

for (const playerCount of [1, 8, 16]) {
  describe(`${playerCount} controlled entities`, () => {
    const game = createGame(playerCount);
    const controls = createControlInputs(playerCount);

    bench("simulation plus runtime snapshot capture", () => {
      game.step(FIXED_STEP_MILLIS, FIXED_STEP_MILLIS, controls);
    });

    bench("compact snapshot encoding only", () => {
      compactSnapshotEntities(game.snapshot.entities);
    });
  });
}

describe("independent authoritative games, eight players each", () => {
  for (const gameCount of [1, 4, 8]) {
    const fixtures = Array.from({ length: gameCount }, () =>
      createSessionFixture(8),
    );

    bench(`${gameCount} games / one fixed step each`, () => {
      for (const fixture of fixtures) fixture.step(1);
    });
  }
});

describe("authoritative input processing", () => {
  const typical = createSessionFixture(8);
  const inputStress = createSessionFixture(16);

  bench("eight players at 4 Hz / 15 fixed steps", () => {
    typical.sendInputBatch();
    typical.step(15);
  });

  bench("sixteen players at 30 Hz / two fixed steps", () => {
    inputStress.sendInputBatch();
    inputStress.step(2);
  });
});

describe("sixteen-player authoritative time scale", () => {
  for (const simulationRate of [1, 10, 60]) {
    const fixture = createSessionFixture(16);

    bench(`${simulationRate}x / ${simulationRate} fixed steps`, () => {
      fixture.step(simulationRate);
    });
  }
});

function createGame(playerCount: number): SolitudeServerGame {
  const entities = Array.from({ length: playerCount }, (_, index) =>
    createDefaultMultiplayerSpacecraftEntity({
      ...spawnProviders,
      entityCount: playerCount,
      id: createEntityId(index),
      index,
    }),
  );
  return createSolitudeServerGame(
    entities,
    createDefaultMultiplayerSimulationPlugins(contentPlugins, {}),
  );
}

function createControlInputs(
  playerCount: number,
): ReadonlyMap<EntityId, Partial<ControlInput>> {
  return new Map(
    Array.from({ length: playerCount }, (_, index) => [
      createEntityId(index),
      { burnForward: true, thrust5: true, yawLeft: index % 2 === 0 },
    ]),
  );
}

interface SessionFixture {
  sendInputBatch: () => void;
  step: (stepCount: number) => void;
}

function createSessionFixture(playerCount: number): SessionFixture {
  const transport = createDefaultSolitudeInProcessTransport(contentPlugins, {});
  const assignments = createSessionAssignments(transport, playerCount);
  const gameId = assignments[0].gameId;
  let inputSequence = 1;
  let protocolSequence = playerCount + 2;

  return {
    sendInputBatch: () => {
      for (let index = 0; index < assignments.length; index++) {
        const assignment = assignments[index];
        const message: InputMessage = {
          clientId: assignment.clientId,
          controls: {
            burnForward: true,
            thrust5: true,
            yawLeft: (inputSequence + index) % 2 === 0,
          },
          entityId: assignment.entityId,
          gameId,
          inputSequence,
          sequence: protocolSequence++,
          type: "input",
        };
        transport.receive(message, message.sequence);
      }
      inputSequence++;
    },
    step: (stepCount) => {
      for (let index = 0; index < stepCount; index++) {
        if (!transport.stepGame(gameId, FIXED_STEP_MILLIS)) {
          throw new Error(`Benchmark game disappeared: ${gameId}`);
        }
      }
    },
  };
}

interface SessionAssignment {
  clientId: SolitudeClientId;
  entityId: EntityId;
  gameId: SolitudeGameId;
}

function createSessionAssignments(
  transport: SolitudeInProcessTransport,
  playerCount: number,
): SessionAssignment[] {
  const creatorClientId = createClientId(0);
  const createdMessages = transport.receive(
    { clientId: creatorClientId, sequence: 1, type: "createGame" },
    1,
  );
  const created = createdMessages.find(
    (message) => message.type === "gameCreated",
  );
  if (!created || created.type !== "gameCreated") {
    throw new Error("Benchmark game creation failed");
  }

  return Array.from({ length: playerCount }, (_, index) => {
    const clientId = createClientId(index);
    const sequence = index + 2;
    const messages = transport.receive(
      {
        clientId,
        gameId: created.gameId,
        sequence,
        type: "joinGame",
      },
      sequence,
    );
    const joined = messages.find((message) => message.type === "joined");
    if (!joined || joined.type !== "joined") {
      throw new Error(`Benchmark client join failed: ${clientId}`);
    }
    return {
      clientId,
      entityId: joined.entityId,
      gameId: created.gameId,
    };
  });
}

function createClientId(index: number): SolitudeClientId {
  return `benchmark-client:${index + 1}`;
}

function createEntityId(index: number): EntityId {
  return `ship:${index + 1}`;
}
