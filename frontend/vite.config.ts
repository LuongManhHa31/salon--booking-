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
      "/api": {
        target: process.env.VITE_BACKEND_URL || "https://salon-booking-backend-mv7p.onrender.com",
        changeOrigin: true,
      },
    },
  },
});
