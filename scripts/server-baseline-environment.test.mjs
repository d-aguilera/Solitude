import { describe, expect, it } from "vitest";
import {
  resolveLoadGeneratorMachine,
  summarizeContainer,
  summarizeCpuTopology,
  summarizeVirtualization,
  validateServerMetadata,
} from "./server-baseline-environment.mjs";

describe("container detection", () => {
  it("reports a native WSL2 host as uncontained", () => {
    expect(
      summarizeContainer({
        cgroup: "0::/init.scope\n",
        containerEnvFile: false,
        dockerEnvFile: false,
        environment: {},
      }),
    ).toEqual({ devcontainer: false, engine: "none", present: false });
  });

  it("identifies a devcontainer separately from its engine", () => {
    expect(
      summarizeContainer({
        cgroup: "0::/\n",
        containerEnvFile: false,
        dockerEnvFile: true,
        environment: { REMOTE_CONTAINERS: "true" },
      }),
    ).toEqual({ devcontainer: true, engine: "docker", present: true });
  });

  it("reads the engine from a cgroup v1 hierarchy", () => {
    expect(
      summarizeContainer({
        cgroup: "12:pids:/kubepods/burstable/pod123/abc\n",
        containerEnvFile: false,
        dockerEnvFile: false,
        environment: {},
      }),
    ).toMatchObject({ engine: "containerd", present: true });
  });

  it("distinguishes podman from docker", () => {
    expect(
      summarizeContainer({
        cgroup: "0::/\n",
        containerEnvFile: true,
        dockerEnvFile: false,
        environment: {},
      }),
    ).toMatchObject({ engine: "podman", present: true });
  });

  it("records an unidentified engine rather than claiming none", () => {
    expect(
      summarizeContainer({
        cgroup: "0::/\n",
        containerEnvFile: false,
        dockerEnvFile: false,
        environment: { container: "oci" },
      }),
    ).toMatchObject({ engine: "unknown", present: true });
  });

  it("does not mistake a systemd init scope for a container", () => {
    expect(
      summarizeContainer({
        cgroup: "0::/init.scope\n",
        containerEnvFile: false,
        dockerEnvFile: false,
        environment: { CODESPACES: "" },
      }).present,
    ).toBe(false);
  });
});

describe("load-generator identity", () => {
  it("uses the stable server label for a same-host generator", () => {
    expect(
      resolveLoadGeneratorMachine({
        observedMachine: "ephemeral-container-id",
        remote: false,
        serverMachine: "reference-server",
      }),
    ).toBe("reference-server");
  });

  it("retains a remote generator name unless explicitly overridden", () => {
    expect(
      resolveLoadGeneratorMachine({
        observedMachine: "windows-host",
        remote: true,
        serverMachine: "reference-server",
      }),
    ).toBe("windows-host");
    expect(
      resolveLoadGeneratorMachine({
        configuredMachine: "generator-alias",
        observedMachine: "windows-host",
        remote: true,
        serverMachine: "reference-server",
      }),
    ).toBe("generator-alias");
  });
});

describe("server baseline environment", () => {
  it("accepts complete version-3 server metadata", () => {
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

  it("requires topology and virtualization in version-3 metadata", () => {
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

  it("requires container context in version-3 metadata", () => {
    const metadata = createMetadata();
    delete metadata.container;
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.container must be an object",
    );
  });

  it("rejects an unrecognized container engine", () => {
    const metadata = createMetadata();
    metadata.container = { devcontainer: false, engine: "jail", present: true };
    expect(() => validateServerMetadata(metadata)).toThrow(
      "server metadata.container.engine is not recognized",
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
    schemaVersion: 3,
    capturedAt: "2026-08-29T00:00:00.000Z",
    commit: "abc123",
    container: { devcontainer: false, engine: "none", present: false },
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
