import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // `vite build --mode extension` packs the app plus extension/ into dist-extension/.
  ...(mode === "extension" && {
    base: "./",
    publicDir: "extension",
    build: { outDir: "dist-extension", emptyOutDir: true },
  }),
  // Backend edits (and its virtual environments) should not reload the page.
  server: { watch: { ignored: ["**/backend/**"] } },
}));
