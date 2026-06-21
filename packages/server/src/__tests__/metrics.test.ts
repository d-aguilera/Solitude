import { describe, expect, it } from "vitest";
import { createSolitudeServerMetrics } from "../metrics";

describe("Solitude server metrics", () => {
  it("reports rolling snapshot stream metrics", () => {
    let nowMillis = 1000;
    const metrics = createSolitudeServerMetrics({
      nowMillis: () => nowMillis,
      windowMillis: 1000,
    });

    metrics.recordSnapshotStep({
      durationMillis: 2,
      entityCount: 3,
      gameId: "game:1",
    });
    metrics.recordSnapshotBroadcast({
      byteLength: 100,
      clientCount: 2,
      gameId: "game:1",
      serializeDurationMillis: 4,
    });
    nowMillis = 1500;
    metrics.recordSnapshotStep({
      durationMillis: 6,
      entityCount: 5,
      gameId: "game:1",
    });
    metrics.recordSnapshotBroadcast({
      byteLength: 140,
      clientCount: 1,
      gameId: "game:1",
      serializeDurationMillis: 8,
    });

    const report = metrics.createReport({
      connectedSockets: 2,
      games: [
        {
          assignedEntityIds: ["ship:1"],
          availableEntityIds: [],
          gameId: "game:1",
          maxClients: 1,
          running: true,
          tick: 12,
        },
      ],
      getClientCount: () => 1,
    });

    expect(report.sockets.connected).toBe(2);
    expect(report.games[0]).toMatchObject({
      clients: 1,
      entityCountAvg: 4,
      gameId: "game:1",
      running: true,
      snapshotPayloadBytesAvg: 120,
      snapshotRateHz: 2,
      snapshotSerializeDurationMillisAvg: 6,
      snapshotSerializeDurationMillisP95: 8,
      snapshotStepDurationMillisAvg: 4,
      snapshotStepDurationMillisP95: 6,
      snapshotWireBytesPerSecond: 340,
      tick: 12,
    });
  });

  it("prunes old samples from the metrics window", () => {
    let nowMillis = 1000;
    const metrics = createSolitudeServerMetrics({
      nowMillis: () => nowMillis,
      windowMillis: 1000,
    });

    metrics.recordSnapshotBroadcast({
      byteLength: 100,
      clientCount: 1,
      gameId: "game:1",
      serializeDurationMillis: 1,
    });
    nowMillis = 2500;

    const report = metrics.createReport({
      connectedSockets: 0,
      games: [
        {
          assignedEntityIds: [],
          availableEntityIds: [],
          gameId: "game:1",
          maxClients: 0,
          running: false,
          tick: 0,
        },
      ],
      getClientCount: () => 0,
    });

    expect(report.games[0]?.snapshotRateHz).toBe(0);
    expect(report.games[0]?.snapshotPayloadBytesAvg).toBe(0);
  });
});
