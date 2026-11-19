import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Dev: /api được proxy tới backend FastAPI. Đổi bằng PVL_API_PROXY_TARGET nếu cần.
const target = process.env.PVL_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": target } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
