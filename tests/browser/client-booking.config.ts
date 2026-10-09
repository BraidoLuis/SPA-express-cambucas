import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const baseURL = process.env.BOOKING_UI_URL || "http://127.0.0.1:3001";
const target = new URL(baseURL);
if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.username || target.password) {
  throw new Error("A verificação da interface aceita somente um servidor local em 127.0.0.1.");
}

export default defineConfig({
  testDir: ".",
  testMatch: "client-booking-navigation.spec.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "line",
  outputDir: path.join(os.tmpdir(), "spa-client-booking-ui-results"),
  use: { baseURL, timezoneId: "Pacific/Kiritimati", trace: "off" },
});
