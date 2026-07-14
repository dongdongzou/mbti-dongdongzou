import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "pages",
  base: "./",
  publicDir: "../public",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(".") },
  },
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
