import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const baseURL = process.env.LEGAL_SEARCH_UI_URL || "http://127.0.0.1:3002";
const target = new URL(baseURL);
if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.username || target.password) {
  throw new Error("A verificação aceita somente um servidor local em 127.0.0.1.");
}

export default defineConfig({
  testDir: ".",
  testMatch: "legal-service-search.spec.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "line",
  outputDir: path.join(os.tmpdir(), "spa-legal-service-search-ui-results"),
  use: { baseURL, timezoneId: "America/Sao_Paulo", trace: "off" },
});
