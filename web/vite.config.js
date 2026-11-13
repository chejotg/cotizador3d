import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base="" permite servir desde subruta (GitHub Pages); Netlify usa "/".
export default defineConfig({
  plugins: [react()],
  base: "/",
  test: {
    environment: "node",
  },
});
