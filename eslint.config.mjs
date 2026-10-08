import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".next-prod/**", ".agents/**", ".codex/**", ".impeccable/**", ".uipro/**", ".playwright-cli/**", "out/**", "build/**", "next-env.d.ts"]),
]);
