import { describe, expect, it } from "vitest";
import { validateServerMetadata } from "./server-baseline-environment.mjs";

describe("server baseline environment", () => {
  it("accepts complete version-1 server metadata", () => {
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
});

function createMetadata() {
  return {
    schemaVersion: 1,
    capturedAt: "2026-08-29T00:00:00.000Z",
    commit: "abc123",
    cpu: "Test CPU",
    cpuAffinity: "not-pinned",
    dirty: false,
    machine: "test-server",
    nodeOptions: "",
    nodeVersion: "v22.0.0",
    platform: "linux x64",
    pluginIdentity: { artifactSha256: "plugin-build" },
    serverArtifactSha256: "server-build",
    serverBuild: "production",
    serverEntry: "dist/server/main.js",
  };
}
