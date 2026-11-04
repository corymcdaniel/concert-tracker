import { defineConfig } from "astro/config";

// Static output. The API lives in netlify/functions, so no Astro adapter is needed.
export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
  vite: {
    // The venue map imports these only when Places opens. Pre-bundling them up front stops the dev
    // server from re-bundling mid-session, which leaves the page asking for a stale copy (504).
    optimizeDeps: { include: ["leaflet", "leaflet.markercluster"] },
  },
});
