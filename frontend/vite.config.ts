import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Cho phép truy cập qua tunnel tạm thời (vd: trycloudflare.com) khi demo từ xa.
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
