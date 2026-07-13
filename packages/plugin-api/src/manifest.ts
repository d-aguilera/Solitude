export const SOLITUDE_PLUGIN_API_VERSION = 1;

export type ExternalPluginEnvironment = "browser" | "server";

export interface ExternalPluginManifest {
  apiVersion: number;
  entry: string;
  environment: ExternalPluginEnvironment;
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
  id: string;
  plugins: readonly string[];
  schemaVersion: number;
}
