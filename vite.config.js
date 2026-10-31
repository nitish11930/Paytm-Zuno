import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    fs: {
      deny: [
        ".env",
        ".env.*",
        "**/privacy/**",
        "**/data/**",
        "**/server/**",
        "**/tests/**",
        "**/*.sqlite*",
        "**/stitch_*/**",
      ],
    },
  },
  build: { sourcemap: false },
});
