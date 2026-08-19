import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

function resolveCommitHash(): string {
  if (process.env.VITE_COMMIT_HASH) {
    return process.env.VITE_COMMIT_HASH;
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(resolveCommitHash()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      // A custom service worker (src/sw.ts) is needed to listen for push
      // notifications (ADR 0025); generateSW cannot add a `push` handler.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // The admin entry is an internal tool: it must never be served or
        // precached by the public service worker.
        globIgnores: ["admin.html", "assets/admin-*"],
      },
      manifest: {
        name: "vicinopoli",
        short_name: "vicinopoli",
        description: "La piazza dei tuoi vicini",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        lang: "it",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        admin: fileURLToPath(new URL("./admin.html", import.meta.url)),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    env: {
      VITE_SUPPORT_EMAIL: "info@vicinopoli.it",
      VITE_PUBLIC_BASE_URL: "http://localhost:8080",
      VITE_GTAG_ID: "",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/api/generated/**",
        "src/main.tsx",
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
    },
  },
});
