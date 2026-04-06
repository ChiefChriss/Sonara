import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
  },
  preview: {
    allowedHosts: [".up.railway.app", "www.sonara.us", "sonara.us"],
  },
});
