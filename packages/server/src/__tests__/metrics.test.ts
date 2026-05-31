import { describe, expect, it } from "vitest";
import {
  createSolitudeServerMetrics,
  measureSnapshotEncodingByteLengths,
} from "../metrics";

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
      encodingByteLengths: {
        current: 100,
        omitAngularVelocity: 90,
        omitFrame: 80,
        quantized6: 70,
        shortKeys: 60,
        tuple: 50,
      },
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
      encodingByteLengths: {
        current: 140,
        omitAngularVelocity: 130,
        omitFrame: 120,
        quantized6: 110,
        shortKeys: 100,
        tuple: 90,
      },
      gameId: "game:1",
      serializeDurationMillis: 8,
    });

    const report = metrics.createReport({
      connectedSockets: 2,
      games: [
        {
          assignedEntityIds: ["ship:blue"],
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
      snapshotEncodingBytesAvg: {
        current: 120,
        omitAngularVelocity: 110,
        omitFrame: 100,
        quantized6: 90,
        shortKeys: 80,
        tuple: 70,
      },
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
      encodingByteLengths: {
        current: 100,
        omitAngularVelocity: 100,
        omitFrame: 100,
        quantized6: 100,
        shortKeys: 100,
        tuple: 100,
      },
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

  it("measures shadow snapshot encoding sizes", () => {
    const sizes = measureSnapshotEncodingByteLengths(
      {
        type: "snapshot",
        entities: [
          {
            angularVelocity: { pitch: 1, roll: 2, yaw: 3 },
            frame: {
              forward: { x: 0, y: 1, z: 0 },
              right: { x: 1, y: 0, z: 0 },
              up: { x: 0, y: 0, z: 1 },
            },
            id: "ship:blue",
            orientation: [
              [1.1234567, 0, 0],
              [0, 1.1234567, 0],
              [0, 0, 1.1234567],
            ],
            position: { x: 1.1234567, y: 2.1234567, z: 3.1234567 },
            velocity: { x: 4.1234567, y: 5.1234567, z: 6.1234567 },
          },
        ],
        gameId: "game:1",
        modelVersion: 1,
        sequence: 2,
        simulationTimeMillis: 1000 / 60,
        tick: 3,
      },
      1000,
    );

    expect(sizes.current).toBe(1000);
    expect(sizes.shortKeys).toBeGreaterThan(0);
    expect(sizes.tuple).toBeGreaterThan(0);
    expect(sizes.omitFrame).toBeLessThan(sizes.current);
    expect(sizes.omitAngularVelocity).toBeLessThan(sizes.current);
    expect(sizes.quantized6).toBeGreaterThan(0);
  });
});
