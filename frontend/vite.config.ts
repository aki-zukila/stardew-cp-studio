import { existsSync } from "node:fs";

const sharedNodeModules = "E:/Codex/zyq-portfolio/node_modules";
const alias = existsSync(sharedNodeModules)
  ? {
      react: `${sharedNodeModules}/react`,
      "react-dom/client": `${sharedNodeModules}/react-dom/client`,
      "react/jsx-runtime": `${sharedNodeModules}/react/jsx-runtime`
    }
  : {};

export default {
  resolve: { alias },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/session/ws": { target: "ws://127.0.0.1:8766", ws: true },
      "/api": "http://127.0.0.1:8766"
    }
  }
};
