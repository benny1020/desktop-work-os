import { test, expect } from '@playwright/test';
import { installConnected, snapshot } from './fixtures/connected.mjs';
import { parseDiff } from '../src/lib/review-model.mjs';

const file = (path, content) => {
  const lines = content.trimEnd().split('\n');
  const diff = `@@ -0,0 +1,${lines.length} @@\n${lines.map(line => '+' + line).join('\n')}`;
  return { path, old_path: path, new_path: path, new_file: true, deleted_file: false, diff, rows: parseDiff(diff), content };
};
const javaPath = (role, area = 'Payment') => `src/main/java/com/acme/backend/${role.toLowerCase()}/${area}${role}.java`;
const layeredFiles = () => ['Payment', 'Order'].flatMap(area => [
  file(javaPath('Controller', area), `package com.acme.backend.controller;\nimport com.acme.backend.service.${area}Service;\n@RestController\n@RequestMapping("/${area.toLowerCase()}s")\npublic class ${area}Controller {\n  private final ${area}Service service;\n  public Receipt submit(Request request) { return service.submit(request); }\n}\n`),
  file(javaPath('Service', area), `package com.acme.backend.service;\nimport com.acme.backend.repository.${area}Repository;\n@Service\npublic class ${area}Service {\n  private final ${area}Repository repository;\n  public Receipt submit(Request request) { return repository.save(request.idempotencyKey()); }\n}\n`),
  file(javaPath('Repository', area), `package com.acme.backend.repository;\n@Repository\npublic interface ${area}Repository {\n  Receipt save(String idempotencyKey);\n}\n`),
]);

async function installArchitecture(page, files, { findings = [] } = {}) {
  await installConnected(page);
  await page.evaluate(({ files, findings, refs }) => {
    const invoke = window.orbit.invoke;
    window.__architectureCalls = [];
    window.orbit.invoke = async (action, args) => {
      window.__architectureCalls.push({ action, args });
      if (action === 'gitlab.code') return { content: files.find(item => item.path === args.path)?.content || '', path: args.path, ref: args.ref };
      if (action === 'claude.review') return { summary: 'Inspect idempotency propagation from the request handler to data access.', findings,
        readingOrder: [], dependencies: [], sequence: [], diffRefs: refs, headSha: refs.head_sha, model: 'claude-fixture',
        coverage: { scope: 'flow', includedFiles: args.paths?.length || files.length, totalFiles: args.paths?.length || files.length, mrTotalFiles: files.length, diffOnly: true } };
      const result = await invoke(action, args);
      if (action === 'gitlab.mr') return { ...result, files: structuredClone(files), guide: null, local: { mode: 'local-git', fileCount: files.length } };
      return result;
    };
  }, { files, findings, refs: snapshot.mr.diff_refs });
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await expect(page.getByLabel('Diagram review comment')).toBeVisible();
}
async function choose(page, search) {
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.getByLabel('Search review flows').fill(search);
  const options = page.locator('.review-flow-options button');
  await expect(options).toHaveCount(1);
  await options.first().click();
}
const node = (page, name) => page.getByRole('button', { name: `Open component ${name}`, exact: true });
const selectedVisible = page => page.evaluate(() => {
  const node = document.querySelector('.diagram-node.selected')?.getBoundingClientRect();
  const panel = document.querySelector('.visual-map-panel')?.getBoundingClientRect();
  const canvas = document.querySelector('.visual-map-panel .diagram-scroll')?.getBoundingClientRect();
  if (!node || !panel || !canvas) return false;
  const visibleWidth = Math.min(node.right, panel.right, canvas.right, innerWidth) - Math.max(node.left, panel.left, canvas.left, 0);
  const visibleHeight = Math.min(node.bottom, panel.bottom, canvas.bottom, innerHeight) - Math.max(node.top, panel.top, canvas.top, 0);
  return node.width >= 125 && visibleWidth >= 125 && visibleHeight >= 40;
});

test('Distinct Payment and Order scopes explain their entry point and Controller / Service / Repository layers', async ({ page }) => {
  await installArchitecture(page, layeredFiles());
  await page.getByLabel('Choose review flow', { exact: true }).click();
  const options = page.locator('.review-flow-options button');
  await expect(options).toHaveCount(2);
  const names = await options.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  expect(new Set(names).size).toBe(2);
  await expect(options.filter({ hasText: 'Payment request handling' })).toContainText('PaymentController.java · PaymentService.java · PaymentRepository.java');
  await expect(options.filter({ hasText: 'Order request handling' })).toContainText('OrderController.java · OrderService.java · OrderRepository.java');
  await options.filter({ hasText: 'Payment request handling' }).click();
  await expect(page.getByLabel('Current review scope')).toContainText('Payment request handling');
  await expect(page.getByLabel('Current review scope')).not.toContainText('OrderController');
  await expect(node(page, 'PaymentController.java')).toHaveAttribute('data-architecture-role', 'controller');
  await expect(node(page, 'PaymentService.java')).toHaveAttribute('data-architecture-role', 'service');
  await expect(node(page, 'PaymentRepository.java')).toHaveAttribute('data-architecture-role', 'repository');
  await expect(page.locator('.architecture-layer')).toHaveCount(3);
  const labels = await page.locator('.architecture-layer').evaluateAll(nodes => nodes.map(item => item.getAttribute('data-role')));
  expect(labels).toEqual(['controller', 'service', 'repository']);
  await page.getByText('Why these files?', { exact: true }).click();
  await expect(page.locator('.review-flow-explanation')).toContainText('2 verified imports');
  await page.getByText('Why these files?', { exact: true }).click();
  await page.getByRole('button', { name: 'Start here', exact: true }).click();
  await expect(page.locator('.visual-code-heading')).toContainText(javaPath('Controller'));
  for (const name of ['PaymentController.java', 'PaymentService.java', 'PaymentRepository.java']) {
    const bounds = await node(page, name).boundingBox();
    expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    expect(bounds.width).toBeGreaterThanOrEqual(125);
  }
  await page.screenshot({ path: 'artifacts/review-architecture-desktop.png' });
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.screenshot({ path: 'artifacts/review-architecture-picker.png' });
});

test('Layer selection, actual source, AI checkpoint and human comment stay together with flow-specific drafts', async ({ page }) => {
  const finding = { path: javaPath('Repository'), line: 4, title: 'Check the idempotency boundary', reason: 'Verify duplicate keys cannot create two receipts.', severity: 'high' };
  await installArchitecture(page, layeredFiles(), { findings: [finding] });
  await choose(page, 'Payment request handling');
  await page.getByRole('button', { name: 'Read PaymentRepository.java', exact: true }).click();
  await expect(page.locator('.visual-code-heading')).toContainText(javaPath('Repository'));
  await expect.poll(() => selectedVisible(page)).toBe(true);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('Component code')).toContainText('Receipt save(String idempotencyKey);');
  await page.getByRole('button', { name: 'Select source line 4', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('Verify this operation is idempotent.');
  await choose(page, 'Order request handling');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('');
  await choose(page, 'Payment request handling');
  await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Verify this operation is idempotent.');
  await page.getByRole('button', { name: 'Generate AI guide', exact: true }).click();
  await expect(page.locator('.ai-review-rail')).toContainText('Review scope: Payment request handling');
  await page.getByRole('button', { name: `Draft comment for ${finding.title}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Diff', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue(`Verify this operation is idempotent.\n\n${finding.title}\n${finding.reason}`);
  const calls = await page.evaluate(() => window.__architectureCalls);
  const request = calls.find(call => call.action === 'claude.review');
  expect(request.args.paths).toEqual(expect.arrayContaining([javaPath('Controller'), javaPath('Service'), javaPath('Repository')]));
  expect(request.args.paths.every(path => path.includes('Payment'))).toBe(true);
  expect(calls.filter(call => ['gitlab.comment', 'gitlab.approve'].includes(call.action))).toEqual([]);
  await page.screenshot({ path: 'artifacts/review-architecture-collaboration.png' });
  await page.getByRole('button', { name: 'Post to GitLab', exact: true }).click();
  const posted = await page.evaluate(() => window.__architectureCalls.find(call => call.action === 'gitlab.comment'));
  expect(posted.args.path).toBe(javaPath('Repository'));
  expect(posted.args.line).toBe(4);
  expect(posted.args.headSha).toBe(snapshot.mr.diff_refs.head_sha);
  expect(posted.args.baseSha).toBe(snapshot.mr.diff_refs.base_sha);
  expect(posted.args.startSha).toBe(snapshot.mr.diff_refs.start_sha);
});

test('Unknown files beside configuration stay explicit and do not gain invented edges or business intent', async ({ page }) => {
  await installArchitecture(page, [file('src/data.ts', 'export const limit = 3;'), file('package.json', '{"name":"payments"}')]);
  await expect(page.getByLabel('Current review scope')).toContainText('Changed files');
  await expect(node(page, 'data.ts')).toHaveAttribute('data-architecture-role', 'other');
  await expect(node(page, 'data.ts')).toContainText('Role unknown');
  await expect(node(page, 'package.json')).toHaveAttribute('data-architecture-role', 'config');
  await expect(page.locator('.dependency-edge')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Dependency flow diagram' })).toContainText('Other / Unclassified');
  await expect(page.getByRole('group', { name: 'Dependency flow diagram' })).toContainText('Configuration');
  await page.getByText('Why these files?', { exact: true }).click();
  await expect(page.locator('.review-flow-explanation')).toContainText('no execution flow established');
  expect(await page.evaluate(() => window.__architectureCalls.some(call => call.action === 'claude.review'))).toBe(false);
});

test('A dependency cycle across Service and Worker layers remains explained with real evidence links', async ({ page }) => {
  const files = [file('src/PaymentService.ts', "import { PaymentWorker } from './PaymentWorker';\nexport class PaymentService { run() { return PaymentWorker.run(); } }"),
    file('src/PaymentWorker.ts', "import { PaymentService } from './PaymentService';\nexport class PaymentWorker { run() { return PaymentService.run(); } }")];
  await installArchitecture(page, files);
  await expect(node(page, 'PaymentService.ts')).toHaveAttribute('data-architecture-role', 'service');
  await expect(node(page, 'PaymentWorker.ts')).toHaveAttribute('data-architecture-role', 'job');
  await expect(page.getByRole('group', { name: 'Dependency flow diagram' })).toContainText('Cyclic dependency');
  const edge = page.getByRole('button', { name: 'Inspect PaymentWorker.ts imports PaymentService.ts', exact: true });
  const hit = await edge.locator('.edge-hit-area').evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(hit.x, hit.y);
  await expect(page.locator('.visual-code-heading')).toContainText('src/PaymentWorker.ts');
  await expect(page.getByRole('button', { name: 'Select new line 1', exact: true })).toHaveClass(/selected/);
  await edge.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.visual-code-heading')).toContainText('src/PaymentWorker.ts');
  await page.getByRole('button', { name: 'By dependency', exact: true }).click();
  await expect(node(page, 'PaymentService.ts')).toHaveAttribute('data-dependency-layer', '0');
  await expect(node(page, 'PaymentWorker.ts')).toHaveAttribute('data-dependency-layer', '0');
});

test('Large directory review parts have readable unique visible titles and searchable last-file coverage', async ({ page }) => {
  const files = Array.from({ length: 29 }, (_, i) => file(`src/features/payment/Change${String(i).padStart(2, '0')}.ts`, `export const change${i} = true;`));
  await installArchitecture(page, files);
  await page.getByLabel('Choose review flow', { exact: true }).click();
  const options = page.locator('.review-flow-options button');
  await expect(options).toHaveCount(3);
  const titles = await options.locator('b').allTextContents();
  expect(new Set(titles).size).toBe(3);
  expect(titles.every(title => /Payment changes · [1-3]\/3/.test(title))).toBe(true);
  await page.getByLabel('Search review flows').fill('Change28.ts');
  await expect(options).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await expect(options.first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.review-component-list')).toContainText('Change28.ts');
  await page.getByRole('button', { name: 'Read Change28.ts', exact: true }).click();
  await expect(page.getByLabel('Component code')).toContainText('export const change28 = true;');
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('max', '29');
});

test('Narrow dark review keeps selected persistence layer readable alongside code and AI, and picker fits the window', async ({ page }) => {
  await installArchitecture(page, layeredFiles());
  await page.getByRole('button', { name: 'Close context preview', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await page.setViewportSize({ width: 980, height: 650 });
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await choose(page, 'Payment request handling');
  await page.getByRole('button', { name: 'Read PaymentRepository.java', exact: true }).click();
  await page.getByLabel('Expand AI review', { exact: true }).click();
  await expect.poll(() => selectedVisible(page)).toBe(true);
  for (const selector of ['.visual-map-panel', '.visual-code-panel', '.ai-review-rail']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds.width).toBeGreaterThan(180);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(981);
    expect(Math.min(bounds.y + bounds.height, 650) - Math.max(bounds.y, 0)).toBeGreaterThan(100);
  }
  await page.screenshot({ path: 'artifacts/review-architecture-narrow-dark.png' });
  await page.getByLabel('Choose review flow', { exact: true }).click();
  const popup = await page.locator('.review-flow-menu').boundingBox();
  expect(popup.x).toBeGreaterThanOrEqual(0);
  expect(popup.x + popup.width).toBeLessThanOrEqual(980);
  await page.screenshot({ path: 'artifacts/review-architecture-narrow-picker.png' });
});
