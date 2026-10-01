/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Two pages: the studio, and /t/ which shows the text from a "text" QR code.
      input: { main: "index.html", viewer: "t/index.html" },
      output: {
        // Libraries change far less often than the app: separate chunks
        // stay cached across deploys.
        manualChunks: {
          react: ["react", "react-dom"],
          renderer: ["qr-code-styling", "qrcode-generator"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
