export const SOLITUDE_PLUGIN_API_VERSION = 3;

export type ExternalPluginHost = "browser" | "server";

export interface ExternalPluginManifest {
  apiVersion: number;
  entry: string;
  id: string;
  schemaVersion: number;
}

export interface ExternalPluginSetManifest {
  packs: readonly string[];
  schemaVersion: number;
}

export interface ExternalPluginLoaderConfig {
  allowedOrigins: readonly string[];
  pluginSet: string;
  schemaVersion: number;
}

export interface ExternalPluginPackManifest {
  hosts: readonly ExternalPluginHost[];
  id: string;
  plugins: readonly string[];
  schemaVersion: number;
}
