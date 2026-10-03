import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const dir = "artifacts/visual-review";
await fs.mkdir(dir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:5178");
await p.evaluate(() => document.fonts.ready);
const shot = async (name) => {
  await p.waitForFunction(() => !document.querySelector(".toast.visible"));
  await p.mouse.move(1420, 880);
  await p.screenshot({ path: `${dir}/${name}.png`, animations: "disabled" });
};
await p.getByRole("button", { name: /Review changes/ }).click();
await p
  .getByRole("button", { name: "Open component OrderService.ts", exact: true })
  .click();
await shot("01-dependency-flow");
await p.getByRole("tab", { name: "Sequence", exact: true }).click();
await shot("02-sequence");
await p.getByRole("button", { name: "Source", exact: true }).click();
await p
  .getByRole("button", { name: "Select source line 7", exact: true })
  .click();
await p
  .getByLabel("Diagram review comment")
  .fill("주문이 없는 경우의 응답 계약과 테스트를 확인해 주세요.");
await shot("03-code-comment");
await p.getByRole("button", { name: "Preview AI guide", exact: true }).click();
await p.locator(".reading-order button").nth(1).click();
await shot("04-ai-guide");
await p.getByLabel("Toggle theme").click();
await shot("05-ai-guide-dark");
await p.getByRole("tab", { name: "Dependency flow", exact: true }).click();
await shot("06-dependency-dark");
await p.getByLabel("Toggle theme").click();
await p.getByRole("button", { name: "Settings", exact: true }).click();
await shot("07-gitlab-settings");
await p.getByRole("button", { name: /Jira Cloud/ }).click();
await shot("08-jira-settings");
await p.getByRole("button", { name: /Confluence Cloud/ }).click();
await shot("09-wiki-settings");
await p.getByRole("button", { name: /Claude · Anthropic API/ }).click();
await shot("10-claude-settings");
await p.getByLabel("Workspace data mode").selectOption("connected");
await p.locator('nav .nav-item[aria-label="Home"]').click();
await shot("11-connected-home");
await fs.writeFile(`${dir}/errors.json`, JSON.stringify(errors));
await b.close();
if (errors.length) throw Error(errors.join("\n"));
