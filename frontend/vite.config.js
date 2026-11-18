
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.svg",
        "app-icon-192.png",
        "app-icon-512.png",
      ],

      manifest: {
        id: "/",
        name: "Moi University Main Altar Reporting System",
        short_name: "Main Altar Reports",
        description:
          "Reporting and activity management system for Moi University Main Altar.",

        start_url: "/",
        scope: "/",

        display: "standalone",
        orientation: "portrait",

        background_color: "#f8fafc",
        theme_color: "#312e81",

        icons: [
          {
            src: "/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: [
          "**/*.{js,css,html,svg,ico,png,woff2}",
        ],
        navigateFallback: "/index.html",
      },
    }),
  ],

  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
