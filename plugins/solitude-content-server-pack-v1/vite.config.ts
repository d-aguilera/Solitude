import { createPolyFighterPackConfig } from "@solitude-plugins/poly-fighter/vite-pack-config";

export default createPolyFighterPackConfig({
  host: "server",
  packId: "solitude-content-server-pack-v1",
  packRoot: new URL(".", import.meta.url),
});
