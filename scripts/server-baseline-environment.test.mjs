import { describe, expect, it } from "vitest";
import {
  summarizeCpuTopology,
  summarizeVirtualization,
  validateServerMetadata,
} from "./server-baseline-environment.mjs";

describe("server baseline environment", () => {
  it("accepts complete version-2 server metadata", () => {
    const metadata = createMetadata();
    expect(validateServerMetadata(metadata)).toBe(metadata);
  });

  it("rejects metadata without server identity", () => {
    const metadata = createMetadata();
    delete metadata.cpu;
    expect(() => validateServerMetadata(metadata, "fixture.json")).toThrow(
      "fixture.json.cpu must be a non-empty string",
    );
  });

  it("rejects metadata without plugin identity", () => {
    const metadata = createMetadata();
    delete metadata.pluginIdentity;
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.pluginIdentity must be an object",
    );
  });

  it("requires topology and virtualization in version-2 metadata", () => {
    const metadata = createMetadata();
    delete metadata.cpuTopology;
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.cpuTopology must be an object",
    );
  });

  it("rejects a non-object virtualization field", () => {
    const metadata = createMetadata();
    metadata.virtualization = "running";
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.virtualization must be an object",
    );
  });

  it("rejects incomplete topology", () => {
    const metadata = createMetadata();
    metadata.cpuTopology = {};
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.cpuTopology.hybrid must be a boolean or null",
    );
  });

  it("rejects incomplete virtualization state", () => {
    const metadata = createMetadata();
    metadata.virtualization = {};
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.virtualization.hypervisorPresent must be a boolean",
    );
  });
});

describe("cpu topology summary", () => {
  it("flags hybrid performance/efficiency parts", () => {
    expect(
      summarizeCpuTopology(processors(12, "i7-1355U"), {
        logicalCores: 12,
        physicalCores: 10,
      }),
    ).toEqual({
      hybrid: true,
      logicalCores: 12,
      models: ["i7-1355U"],
      physicalCores: 10,
      visibleLogicalCores: 12,
    });
  });

  it("does not flag a uniformly hyper-threaded part", () => {
    expect(
      summarizeCpuTopology(processors(8, "i7-7700HQ"), {
        logicalCores: 8,
        physicalCores: 4,
      }).hybrid,
    ).toBe(false);
  });

  it("reports unknown hybrid state without host core counts", () => {
    expect(summarizeCpuTopology(processors(8, "unknown"), null)).toEqual({
      hybrid: null,
      logicalCores: 8,
      models: ["unknown"],
      physicalCores: null,
      visibleLogicalCores: 8,
    });
  });

  it("retains the guest view when fewer cores are exposed than the host has", () => {
    expect(
      summarizeCpuTopology(processors(4, "i7-1355U"), {
        logicalCores: 12,
        physicalCores: 10,
      }),
    ).toMatchObject({ logicalCores: 12, visibleLogicalCores: 4 });
  });
});

describe("virtualization summary", () => {
  it("reports running memory integrity from device guard facts", () => {
    expect(
      summarizeVirtualization(
        { hypervisorFlag: true, name: "wsl2" },
        {
          hypervisorPresent: true,
          securityServicesRunning: [2],
          vbsStatus: 2,
        },
      ),
    ).toEqual({
      hypervisorPresent: true,
      runtime: "wsl2",
      vbs: { hvci: true, status: "running" },
    });
  });

  it("separates an active hypervisor from unenforced memory integrity", () => {
    expect(
      summarizeVirtualization(
        { hypervisorFlag: true, name: "wsl2" },
        { hypervisorPresent: true, securityServicesRunning: [], vbsStatus: 0 },
      ).vbs,
    ).toEqual({ hvci: false, status: "off" });
  });

  it("falls back to the guest hypervisor flag without Windows facts", () => {
    expect(
      summarizeVirtualization(
        { hypervisorFlag: false, name: "bare-metal" },
        null,
      ),
    ).toEqual({
      hypervisorPresent: false,
      runtime: "bare-metal",
      vbs: null,
    });
  });

  it("names a native Windows load generator", () => {
    expect(
      summarizeVirtualization(
        { hypervisorFlag: false, name: "unknown" },
        {
          hypervisorPresent: true,
          securityServicesRunning: [1, 2],
          vbsStatus: 2,
        },
      ),
    ).toMatchObject({ hypervisorPresent: true, runtime: "windows-host" });
  });
});

function processors(count, model) {
  return Array.from({ length: count }, () => ({ model, speed: 0 }));
}

function createMetadata() {
  return {
    schemaVersion: 2,
    capturedAt: "2026-08-29T00:00:00.000Z",
    commit: "abc123",
    cpu: "Test CPU",
    cpuAffinity: "not-pinned",
    cpuTopology: {
      hybrid: false,
      logicalCores: 8,
      models: ["Test CPU"],
      physicalCores: 4,
      visibleLogicalCores: 8,
    },
    dirty: false,
    machine: "test-server",
    nodeOptions: "",
    nodeVersion: "v22.0.0",
    platform: "linux x64",
    pluginIdentity: { artifactSha256: "plugin-build" },
    serverArtifactSha256: "server-build",
    serverBuild: "production",
    serverEntry: "dist/server/main.js",
    virtualization: {
      hypervisorPresent: false,
      runtime: "bare-metal",
      vbs: null,
    },
  };
}
