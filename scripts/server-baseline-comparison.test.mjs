import { describe, expect, it } from "vitest";
import {
  compareServerBaselines,
  comparisonMetrics,
  renderServerBaselineComparisonMarkdown,
} from "./server-baseline-comparison.mjs";

describe("server baseline comparison", () => {
  it("reports equal values, run spread, and matching identity", () => {
    const reference = createBaseline();
    const comparison = compare(reference, structuredClone(reference));
    expect(comparison.blocking).toBe(false);
    expect(comparison.environment).toEqual({ matches: true, mismatches: [] });
    expect(comparison.coverage.comparedWorkloads).toBe(1);
    expect(comparison.summary).toEqual({
      candidateConfirmedSaturationWorkloads: 0,
      candidateFirstCapacitySaturationGames: null,
      comparedMetrics: comparisonMetrics.length,
      metricsOutsideReferenceRange: 0,
      referenceConfirmedSaturationWorkloads: 0,
      referenceFirstCapacitySaturationGames: null,
    });
    expect(comparison.workloads[0].metrics[0]).toMatchObject({
      absoluteDelta: 0,
      candidateOutsideReferenceRange: false,
      candidateSpread: { count: 3, max: 12, min: 10, p50: 11, p95: 12 },
      candidateValue: 11,
      percentDelta: 0,
      referenceValue: 11,
    });
  });

  it("reports absolute and percentage deltas outside reference spread", () => {
    const reference = createBaseline();
    const candidate = createBaseline();
    for (const run of candidate.scenarios[0].runs) {
      run.server.processCpuUtilizationPercent.p50 += 11;
    }
    const comparison = compare(reference, candidate);
    expect(comparison.workloads[0].metrics[0]).toMatchObject({
      absoluteDelta: 11,
      candidateOutsideReferenceRange: true,
      candidateValue: 22,
      percentDelta: 100,
      referenceValue: 11,
    });
    expect(comparison.summary.metricsOutsideReferenceRange).toBe(1);
  });

  it("omits a percentage delta when the reference value is zero", () => {
    const reference = createBaseline();
    const candidate = createBaseline();
    for (const run of reference.scenarios[0].runs) {
      run.client.inputAckLatencyMillis.p99 = 0;
    }
    const comparison = compare(reference, candidate);
    expect(
      comparison.workloads[0].metrics.find(
        (entry) => entry.name === "inputAckLatencyMillisP99",
      ),
    ).toMatchObject({ absoluteDelta: 20, percentDelta: null });
  });

  it("reports environment, coverage, and scenario incompatibilities", () => {
    const reference = createBaseline();
    const candidate = createBaseline();
    candidate.cpu = "different CPU";
    candidate.pluginIdentity.artifactSha256 = "different-plugin-build";
    candidate.scenarios[0].scenario.clientsPerGame = 16;
    candidate.capacitySweep.push(
      createWorkload("capacity-extra", "capacity", 2),
    );
    const comparison = compare(reference, candidate);
    expect(comparison.environment.matches).toBe(false);
    expect(comparison.environment.mismatches.map((item) => item.field)).toEqual(
      expect.arrayContaining(["cpu", "pluginIdentity.artifactSha256"]),
    );
    expect(comparison.coverage).toMatchObject({
      candidateOnly: ["capacity:capacity-extra"],
      comparedWorkloads: 0,
      incompatibleWorkloads: ["typical"],
    });
    expect(comparison.workloads[0]).toMatchObject({
      compatible: false,
      metrics: [],
      scenarioMismatches: [{ field: "clientsPerGame" }],
    });
  });

  it("compares complete server and load-generator identities", () => {
    const reference = createBaseline();
    const candidate = createBaseline();
    candidate.environment.loadGeneratorEnvironment.virtualization.vbs = {
      hvci: true,
      status: "running",
    };
    const comparison = compare(reference, candidate);
    expect(comparison.environment.mismatches).toEqual([
      expect.objectContaining({
        field: "environment.loadGeneratorEnvironment",
      }),
    ]);
  });

  it("renders an explicitly non-blocking Markdown report", () => {
    const comparison = compare(createBaseline(), createBaseline());
    const markdown = renderServerBaselineComparisonMarkdown(comparison);
    expect(markdown).toContain("This report is **non-blocking**");
    expect(markdown).toContain("Reference spread");
    expect(markdown).toContain("min/p50/p95/max");
    expect(markdown).toContain("### scenario: typical");
  });

  it("rejects documents that are not version-2 baselines", () => {
    expect(() =>
      compareServerBaselines({
        candidate: {},
        candidatePath: "candidate.json",
        reference: createBaseline(),
        referencePath: "reference.json",
      }),
    ).toThrow("candidate must be a version-2 server baseline");
  });
});

function compare(reference, candidate) {
  return compareServerBaselines({
    candidate,
    candidatePath: "candidate.json",
    reference,
    referencePath: "reference.json",
  });
}

function createBaseline() {
  const workload = createWorkload("typical", "scenario", 1);
  return {
    schemaVersion: 2,
    analysisPolicy: { confirmation: "majority" },
    capacitySweep: [],
    commit: "abc123",
    cpu: "Test CPU",
    dirty: false,
    environment: {
      cpuAffinity: "not-pinned",
      loadGenerator: "same-host-separate-process",
      loadGeneratorEnvironment: createEnvironment("test-machine"),
      machine: "test-machine",
      nodeOptions: "",
      serverEnvironment: createEnvironment("test-machine"),
      topology: "same-host-loopback",
    },
    machine: "test-machine",
    measurementSeconds: 60,
    nodeVersion: "v22.0.0",
    platform: "linux x64",
    pluginIdentity: {
      artifactSha256: "plugin-build",
      packs: [{ id: "pack", plugins: [{ apiVersion: 11, id: "plugin" }] }],
      schemaVersion: 1,
    },
    profile: "reference",
    protocol: {
      productionBuildCreatedOnce: true,
      repetitions: 3,
      restartStrategy: "local-process",
      serverArtifactSha256: "server-build",
      serverEntry: "dist/server/main.js",
      serverMode: "local",
      serverRestartedBetweenRepetitions: true,
      serverUrl: "dynamic-loopback",
    },
    provisionalThresholds: { simulationThroughputRatio: 0.99 },
    scenarios: [workload],
    warmupSeconds: 15,
  };
}

function createEnvironment(machine) {
  return {
    commit: "abc123",
    cpu: "Test CPU",
    cpuTopology: {
      hybrid: false,
      logicalCores: 8,
      models: ["Test CPU"],
      physicalCores: 4,
      visibleLogicalCores: 8,
    },
    dirty: false,
    machine,
    nodeOptions: "",
    nodeVersion: "v22.0.0",
    platform: "linux x64",
    virtualization: {
      hypervisorPresent: false,
      runtime: "bare-metal",
      vbs: null,
    },
  };
}

function createWorkload(name, kind, games) {
  const runs = [createRun(1, 10), createRun(2, 11), createRun(3, 12)];
  return {
    runs,
    scenario: {
      clientsPerGame: 8,
      games,
      inputHzPerClient: 4,
      name,
      simulationMillisPerWallMillis: 1,
    },
    summary: {
      confirmedSaturation: false,
      medianRunRepetition: 2,
      saturationCount: 0,
    },
    testKind: kind,
  };
}

function createRun(repetition, cpu) {
  const numbers = (value) => ({
    avg: value,
    count: 1,
    max: value,
    min: value,
    p50: value,
    p95: value,
    p99: value,
  });
  const duration = (value) => ({
    avg: numbers(value),
    max: numbers(value),
    p50: numbers(value),
    p95: numbers(value),
    p99: numbers(value),
  });
  return {
    analysis: {
      minimumPerGameMedianSimulationThroughputRatio: 1,
      minimumPerGameMedianSnapshotRateHz: 60,
      saturated: false,
    },
    client: {
      inputAckLatencyMillis: numbers(20),
      snapshotInterArrivalMillis: numbers(17),
    },
    errors: [],
    repetition,
    server: {
      broadcastLoopDurationMillis: duration(1),
      eventLoopDelayMillis: duration(10),
      processCpuUtilizationPercent: numbers(cpu),
      processHeapUsedBytes: numbers(20 * 1024 * 1024),
      processRssBytes: numbers(80 * 1024 * 1024),
      simulationBacklogMillis: numbers(5),
      snapshotSerializeDurationMillis: duration(0.2),
      snapshotStepDurationMillis: duration(0.5),
      snapshotWireBytesPerSecond: numbers(1024 * 1024),
    },
  };
}
