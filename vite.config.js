import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Backend edits (and its virtual environments) should not reload the page.
  server: { watch: { ignored: ["**/backend/**"] } },
});
