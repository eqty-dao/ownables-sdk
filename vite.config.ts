import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "src")}/`,
      },
      {
        find: /^@ownables\/platform-browser$/,
        replacement: path.resolve(
          __dirname,
          "../ownables-js/packages/platform-browser/src/index.ts"
        ),
      },
    ],
  },
  server: {
    port: 3000,
    fs: {
      allow: [
        path.resolve(__dirname),
      ],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.letsrunit/**']
    },
    watch: {
      ignored: ["**/.letsrunit/**"],
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
