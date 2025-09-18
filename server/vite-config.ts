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
      },
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