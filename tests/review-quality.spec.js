import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

const openReview = (page) => page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
const component = (page, name) => page.getByRole("button", { name: `Open component ${name}.ts`, exact: true });

test("Dependency layers follow importer edges and reading path opens code without AI", async ({ page }) => {
  await installConnected(page); await openReview(page);
  await expect(component(page, "PaymentController")).toHaveAttribute("data-dependency-layer", "0");
  await expect(component(page, "PaymentWorker")).toHaveAttribute("data-dependency-layer", "0");
  await expect(component(page, "PaymentService")).toHaveAttribute("data-dependency-layer", "1");
  await expect(component(page, "RetryQueue")).toHaveAttribute("data-dependency-layer", "2");
  await expect(page.getByLabel("Review reading path")).toContainText("4 files");
  await page.getByRole("button", { name: "Read RetryQueue.ts", exact: true }).click();
  await expect(page.locator(".visual-code-heading")).toContainText("src/RetryQueue.ts");
  await expect(page.getByLabel("Component code")).toContainText("jobId: job.idempotencyKey");
  expect(await page.evaluate(() => window.__fixture.calls.some((call) => call.action === "claude.review"))).toBe(false);
});

test("Diagram keys select code and fit adapts to assistant while manual zoom is preserved", async ({ page }) => {
  await installConnected(page); await openReview(page);
  const worker = component(page, "PaymentWorker");
  await worker.focus(); await page.keyboard.press("Space");
  await expect(page.locator(".visual-code-heading")).toContainText("PaymentWorker.ts");
  await page.keyboard.press("Home");
  await expect(page.locator(".dependency-edge").first()).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator(".code-provenance")).toContainText("Selected new line");
  await page.keyboard.press("Meta+j");
  await expect.poll(() => page.locator(".diagram-scroll").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.getByLabel("Zoom in diagram").click();
  const manualWidth = await page.getByRole("img", { name: "Dependency flow diagram" }).getAttribute("width");
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.getByRole("img", { name: "Dependency flow diagram" })).toHaveAttribute("width", manualWidth);
  await page.getByLabel("Fit diagram to panel").click();
  await expect.poll(() => page.locator(".diagram-scroll").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect.poll(() => page.locator(".visual-review-grid").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test("Cycles render in one layer without unbounded graph depth", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "gitlab.mr") result.files.find((f) => f.path === "src/RetryQueue.ts").content = "import { PaymentService } from './PaymentService';";
      return result;
    };
  });
  await openReview(page);
  await expect(component(page, "PaymentService")).toHaveAttribute("data-dependency-layer", "1");
  await expect(component(page, "RetryQueue")).toHaveAttribute("data-dependency-layer", "1");
  await expect(page.getByRole("img", { name: "Dependency flow diagram" })).toContainText("Cyclic dependency");
});

test("Demo sequence components are keyboard operable and preserve selection", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: /Review changes/ }).click();
  await page.getByRole("tab", { name: "Sequence", exact: true }).click();
  await component(page, "OrderService").focus(); await page.keyboard.press("Space");
  await expect(page.locator(".visual-code-heading")).toContainText("OrderService.ts");
  await expect(component(page, "OrderService")).toHaveAttribute("aria-pressed", "true");
});
