import { defineConfig } from "astro/config";

// Static output. The API lives in netlify/functions, so no Astro adapter is needed.
export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
});
