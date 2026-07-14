export const SOLITUDE_PLUGIN_API_VERSION = 3;

export type ExternalPluginHostEnvironment = "browser" | "server";
export type ExternalPluginEnvironment =
  | ExternalPluginHostEnvironment
  | "universal";

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
