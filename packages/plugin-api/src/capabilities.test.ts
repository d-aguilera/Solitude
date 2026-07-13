import {
  entityNameProviderCapability as canonicalEntityNameProviderCapability,
  createEntityNameProvider as createCanonicalEntityNameProvider,
  formatEntityName as formatCanonicalEntityName,
} from "@solitude/entity-names";
import { describe, expect, it } from "vitest";
import {
  createEntityNameProvider,
  entityNameProviderCapability,
  formatEntityName,
} from "./capabilities";

describe("plugin API capabilities", () => {
  it("re-exports the canonical entity-name capability and policy", () => {
    expect(entityNameProviderCapability).toBe(
      canonicalEntityNameProviderCapability,
    );
    expect(createEntityNameProvider).toBe(createCanonicalEntityNameProvider);
    expect(formatEntityName).toBe(formatCanonicalEntityName);
  });
});
