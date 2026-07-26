import { createSolitudeContentPackConfig } from "@solitude-plugins/solitude-content-pack/vite-pack-config";

export default createSolitudeContentPackConfig({
  host: "server",
  packId: "solitude-content-server-pack-v1",
  packRoot: new URL(".", import.meta.url),
});
