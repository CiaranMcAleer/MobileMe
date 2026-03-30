import { defineConfig } from "vite";

export default defineConfig({
  base: "/MobileMe/",
  server: {
    fs: {
      allow: [".."],
    },
  },
});
