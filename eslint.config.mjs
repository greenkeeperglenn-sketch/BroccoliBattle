import { defineConfig, globalIgnores } from "eslint/config";
import { flatConfig as next } from "@next/eslint-plugin-next";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    ".data/**",
    "playwright-report/**",
    "test-results/**",
    "public/sw.js",
  ]),
  next.coreWebVitals,
]);
