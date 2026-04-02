import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  root: ".",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        widget: path.resolve(__dirname, "widget.html"),
        quickswitch: path.resolve(__dirname, "quickswitch.html"),
        startofday: path.resolve(__dirname, "startofday.html"),
        welcomeback: path.resolve(__dirname, "welcomeback.html"),
      },
    },
  },
});
