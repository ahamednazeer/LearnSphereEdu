// This file contains the vite config for development only
// It's separated to avoid bundling vite dependencies in production

export async function getViteConfig() {
  const { defineConfig } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const path = await import("path");
  const runtimeErrorOverlay = (await import("@replit/vite-plugin-runtime-error-modal")).default;

  return defineConfig({
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
        "@": path.resolve(import.meta.dirname, "..", "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "..", "shared"),
        "@assets": path.resolve(import.meta.dirname, "..", "attached_assets"),
        // Absolute paths for dev server middleware, matching root vite.config.ts
        buffer: path.resolve(import.meta.dirname, "..", "node_modules", "buffer", "index.js"),
        process: path.resolve(import.meta.dirname, "..", "node_modules", "process", "browser.js"),
        util: path.resolve(import.meta.dirname, "..", "node_modules", "util", "util.js"),
        stream: path.resolve(import.meta.dirname, "..", "node_modules", "stream-browserify", "index.js"),
        // Use local shim for events to avoid package resolution issues
        events: path.resolve(import.meta.dirname, "..", "shared", "events.cjs"),
        "readable-stream": path.resolve(import.meta.dirname, "..", "node_modules", "readable-stream", "readable-browser.js"),
        // "simple-peer": "simple-peer/simplepeer.min.js",
      },
      dedupe: ["simple-peer"],
    },
    root: path.resolve(import.meta.dirname, "..", "client"),
    publicDir: path.resolve(import.meta.dirname, "..", "client/public"),
    build: {
      outDir: path.resolve(import.meta.dirname, "..", "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  });
}