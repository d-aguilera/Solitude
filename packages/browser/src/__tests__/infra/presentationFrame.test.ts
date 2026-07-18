import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { describe, expect, it, vi } from "vitest";
import {
  collectPresentationFrameProviders,
  presentationFrameCapability,
  updatePresentationFrameProviders,
} from "../../infra/presentationFrame";

describe("presentation frame providers", () => {
  it("collects valid providers and updates each one", () => {
    const updatePresentationFrame = vi.fn();
    const registry = createPluginCapabilityRegistry([
      {
        id: "telemetry",
        capabilities: [
          {
            id: presentationFrameCapability,
            value: { updatePresentationFrame },
          },
          { id: presentationFrameCapability, value: {} },
        ],
      },
    ]);
    const providers = collectPresentationFrameProviders(registry);

    updatePresentationFrameProviders(providers, {
      dtMillis: 1000 / 60,
      nowMs: 1234,
    });

    expect(providers).toHaveLength(1);
    expect(updatePresentationFrame).toHaveBeenCalledWith({
      dtMillis: 1000 / 60,
      nowMs: 1234,
    });
  });
});
