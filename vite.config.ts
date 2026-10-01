import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: 5180,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:5100",
          changeOrigin: true,
        },
      },
    },
    preview: { port: 5180, strictPort: true },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(moduleId) {
            if (!moduleId.includes("node_modules")) return;
            if (/node_modules[\\/]react(?:-dom|-router|-router-dom)?[\\/]/.test(moduleId))
              return "react";
            if (["axios", "@tanstack/react-query"].some((dep) => moduleId.includes(`node_modules/${dep}`)))
              return "network";
          },
        },
      },
    },
  };
});
