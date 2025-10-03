import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // Absolute paths to ensure esbuild resolves shims correctly
      buffer: path.resolve(import.meta.dirname, "node_modules", "buffer", "index.js"),
      process: path.resolve(import.meta.dirname, "node_modules", "process", "browser.js"),
      util: path.resolve(import.meta.dirname, "node_modules", "util", "util.js"),
      stream: path.resolve(import.meta.dirname, "node_modules", "stream-browserify", "index.js"),
      // Use local shim for events to avoid package resolution issues
      events: path.resolve(import.meta.dirname, "shared", "events.cjs"),
      "readable-stream": path.resolve(import.meta.dirname, "node_modules", "readable-stream", "readable-browser.js"),
      // Keep default import path for simple-peer, but shim Node deps
      // "simple-peer": "simple-peer/simplepeer.min.js",
    },
    dedupe: ["simple-peer"],
  },
  optimizeDeps: {
    include: ["buffer", "process", "events", "stream-browserify"],
    exclude: ["simple-peer"], // ensure alias 'simple-peer/simplepeer.min.js' is used
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  define: {
    global: 'globalThis',
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
