import { defineConfig } from "vite";

const appBasePath = process.env.VITE_APP_BASE_PATH || "/MobileMe/";

export default defineConfig({
  base: appBasePath,
  server: {
    fs: {
      allow: [".."],
    },
  },
});
