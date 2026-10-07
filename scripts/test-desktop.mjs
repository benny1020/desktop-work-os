import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const root = new URL("../", import.meta.url).pathname;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-desktop-test-"));
const app = await electron.launch({
  args: [root],
  env: { ...process.env, ORBIT_USER_DATA_DIR: temp },
});
const evidence = {
  scope: "Native Electron / OS encrypted vault / renderer IPC",
  externalServicesTested: false,
};
try {
  const p = await app.firstWindow();
  evidence.worklaneName = await app.evaluate(({app}) => app.getName()) === "Worklane";
  if (!evidence.worklaneName) throw new Error("Electron app name was not updated");
  await expect(p).toHaveTitle(/Worklane/);
  await app.evaluate(async ({protocol})=>{
    globalThis.__nativeRequestVerified=false;
    await protocol.handle('https',(request)=>{
      const url=new URL(request.url);
      if(url.hostname==='gitlab.fixture.invalid'&&url.pathname==='/api/v4/user'){
        globalThis.__nativeRequestVerified=request.headers.get('private-token')==='native-fixture-secret-not-real';
        return new Response(JSON.stringify({id:3,name:'Native fixture user'}),{headers:{'content-type':'application/json'}});
      }
      return new Response('',{status:404});
    });
  });
  await expect(
    p.getByRole("heading", { name: "Good morning, Alex." }),
  ).toBeVisible();
  evidence.preload = await p.evaluate(
    () => typeof window.orbit.invoke === "function",
  );
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(p.getByLabel("API token")).toBeEnabled();
  await p.getByLabel("Service URL").fill("https://gitlab.fixture.invalid");
  await p.getByLabel("API token").fill("native-fixture-secret-not-real");
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    p.getByRole("status").filter({ hasText: "Saved securely" }),
  ).toBeVisible();
  await p.getByRole('button',{name:'Save & test connection',exact:true}).click();
  await expect(p.getByRole('status').filter({hasText:'Connection verified'})).toBeVisible();
  evidence.nativeFetchAndAuth=await app.evaluate(()=>globalThis.__nativeRequestVerified);
  const file = path.join(temp, "integrations.enc");
  const encrypted = await fs.readFile(file);
  evidence.noPlaintextToken = !encrypted.includes(
    "native-fixture-secret-not-real",
  );
  evidence.privateMode = ((await fs.stat(file)).mode & 0o777) === 0o600;
  const config = await p.evaluate(() => window.orbit.invoke("config.list"));
  evidence.redactedConfig =
    config.gitlab.token === undefined && config.gitlab.tokenConfigured;
  evidence.noTokenInLocalStorage = await p.evaluate(
    () =>
      !JSON.stringify(localStorage).includes("native-fixture-secret-not-real"),
  );
  await p.reload();
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(p.getByLabel("API token")).toHaveAttribute(
    "placeholder",
    "Keep saved token, or enter a replacement",
  );
  evidence.reloadPersistence = true;
  const invalid = await p.evaluate(async () => {
    try {
      await window.orbit.invoke("config.save", {
        service: "gitlab",
        config: { url: "http://unsafe.test", token: "test" },
      });
      return false;
    } catch {
      return true;
    }
  });
  evidence.httpRejected = invalid;
  await p
    .getByRole("button", { name: "Remove connection", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Remove connection", exact: true }),
  ).toHaveCount(0);
  evidence.remove = true;
  await p.locator('nav .nav-item[aria-label="Home"]').click();
  await p.getByRole("button", { name: /Review changes/ }).click();
  await expect(
    p.getByRole("img", { name: "Dependency flow diagram" }),
  ).toBeVisible();
  await p.getByRole("tab", { name: "Sequence", exact: true }).click();
  await expect(p.getByRole("img", { name: "Sequence diagram" })).toBeVisible();
  evidence.diagrams = true;
  await fs.mkdir(root + "artifacts/visual-review", { recursive: true });
  await p.screenshot({
    path: root + "artifacts/visual-review/electron-sequence.png",
  });
  await p.getByRole('button', { name: 'Code', exact: true }).click();
  await p.getByRole('row').filter({ hasText: 'Separate capture and refund request paths' }).getByRole('button', { name: 'Review', exact: true }).click();
  await expect(p.getByLabel('Current API flow')).toContainText('POST /payments/capture');
  await expect(p.getByRole('button', { name: 'Source', exact: true })).toHaveClass(/active/);
  evidence.productionApiWorker = true;
  await p.getByLabel('Choose review flow', { exact: true }).click();
  await p.getByRole('button', { name: 'Review flow POST /payments/refund', exact: true }).click();
  await p.getByRole('button', { name: 'Open component PaymentService.ts', exact: true }).click();
  await expect(p.getByLabel('Methods in this API flow')).toContainText('refund()');
  await expect(p.getByLabel('Methods in this API flow')).not.toContainText('capture()');
  evidence.productionApiMethodIsolation = true;
  if (
    Object.values(evidence).includes(false) &&
    evidence.externalServicesTested !== false
  )
    throw Error("Native test failed");
  for (const [key, value] of Object.entries(evidence))
    if (key !== "externalServicesTested" && typeof value === "boolean")
      expect(value, key).toBe(true);
  await fs.mkdir(root + "research/integration-review", { recursive: true });
  await fs.writeFile(
    root + "research/integration-review/electron-tests.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
