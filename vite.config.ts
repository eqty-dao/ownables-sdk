import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@ui\/mui$/,
        replacement: path.resolve(__dirname, "src/ui/mui/index.tsx"),
      },
      {
        find: /^@ui\/mui\/Alert\/Alert$/,
        replacement: path.resolve(__dirname, "src/ui/mui/Alert/Alert.ts"),
      },
      {
        find: /^@ui\/mui\/(.*)$/,
        replacement: path.resolve(__dirname, "src/ui/mui/$1.tsx"),
      },
      {
        find: /^@ui\/icons$/,
        replacement: path.resolve(__dirname, "src/ui/icons/index.tsx"),
      },
      {
        find: /^@ui\/icons\/(.*)$/,
        replacement: path.resolve(__dirname, "src/ui/icons/$1.tsx"),
      },
    ],
  },
  server: {
    port: 3000,
  },
});
