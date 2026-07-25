import { createPolyFighterPackConfig } from "@solitude-plugins/poly-fighter/vite-pack-config";

export default createPolyFighterPackConfig({
  host: "browser",
  packId: "solitude-content-browser-pack-v1",
  packRoot: new URL(".", import.meta.url),
});
