import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@ownables/builder",
        replacement: path.resolve(__dirname, "../ownables-js/packages/builder/src/index.ts"),
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "src")}/`,
      },
    ],
  },
  server: {
    port: 3000,
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "../ownables-js"),
      ],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.letsrunit/**']
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
