import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    // Read the central .env from the repo root instead of frontend/.env.
    envDir: path.resolve(__dirname, ".."),
    server: {
        host: true,
        watch: {
            usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
        },
    },
    resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../packages/shared/src'),
      '@backend-core': path.resolve(__dirname, '../packages/backend-core/src'),
    },
  },
});
