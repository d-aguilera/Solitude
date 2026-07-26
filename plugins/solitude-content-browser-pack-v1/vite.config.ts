import { createSolitudeContentPackConfig } from "@solitude-plugins/solitude-content-pack/vite-pack-config";

export default createSolitudeContentPackConfig({
  host: "browser",
  packId: "solitude-content-browser-pack-v1",
  packRoot: new URL(".", import.meta.url),
});
