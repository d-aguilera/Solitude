export interface ExternalPluginCapabilityProvider {
  id: string;
  value: unknown;
}

export interface ExternalPluginCapabilityRegistry {
  getAll: (id: string) => readonly unknown[];
}
