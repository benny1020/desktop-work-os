// Isolated Chromium and local connector fixtures only. These are sample renders.
import { chromium, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
import fs from "node:fs/promises";
const out = process.argv[2] || "/tmp/worklane-home-cockpit";
const baseURL = process.env.WORKLANE_CAPTURE_URL || "http://127.0.0.1:5178";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const captures = [];
for (const [width, height] of [[1440, 900], [980, 720]]) for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ baseURL, viewport: { width, height } });
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00+09:00"));
  await installConnected(page);
  await expect(page.locator(".inbox-work").first()).toBeVisible();
  if (theme === "dark") await page.getByLabel("Toggle theme").click();
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
    const file = `${out}/${width}-${theme}-${name}.png`;
    await page.screenshot({ path: file, animations: "disabled" });
    captures.push({ file, fixture: true, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  };
  await capture("home-empty");
  await page.getByLabel("Personal item type").selectOption("event");
  await page.getByLabel("Quick add personal work").fill("Backend sync 10am");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await page.getByLabel("Personal item type").selectOption("task");
  await page.getByLabel("Quick add personal work").fill("Prepare rollout notes 2pm");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await capture("home-planned");
  await page.locator('nav .nav-item[aria-label="My Work"]').click();
  await capture("today-planned");
  await page.close();
}
await browser.close();
await fs.writeFile(`${out}/captures.json`, JSON.stringify(captures, null, 2));
console.log(`Saved ${captures.length} local fixture captures to ${out}. No real accounts or services were used.`);
