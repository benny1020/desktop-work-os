import { test, expect } from '@playwright/test';
import { installConnected, snapshot } from './fixtures/connected.mjs';
import { parseDiff } from '../src/lib/review-model.mjs';

const file = (path, content) => {
  const lines = content.trimEnd().split('\n');
  const diff = `@@ -0,0 +1,${lines.length} @@\n${lines.map(line => '+' + line).join('\n')}`;
  return { path, old_path: path, new_path: path, new_file: true, deleted_file: false, diff, rows: parseDiff(diff), content };
};
const sharedPath = 'src/shared/SharedLimiter.ts';
const groupedFiles = () => [
  ...['orders', 'payments'].flatMap(area => Array.from({ length: 7 }, (_, i) => file(`src/${area}/${area}Action${i}.ts`,
    `import { SharedLimiter } from '../shared/SharedLimiter';\nexport function ${area}Action${i}() {\n  return SharedLimiter.allow();\n}\n`))),
  file(sharedPath, 'export class SharedLimiter {\n  static allow() { return true; }\n}\n'),
];
async function installFlows(page, files, { guide } = {}) {
  await installConnected(page);
  await page.evaluate(({ files, guide }) => {
    const original = window.orbit.invoke;
    window.__flowCalls = [];
    window.__flowFiles = files;
    window.__flowDiffFailure = '';
    window.orbit.invoke = async (action, args) => {
      window.__flowCalls.push({ action, args });
      if (action === 'gitlab.diff') {
        if (window.__flowDiffFailure === args.path) throw Error('Temporary local diff failure');
        const selected = window.__flowFiles.find(item => item.path === args.path);
        return { ...selected, rows: selected.fullRows || selected.rows, diff: selected.fullDiff || selected.diff,
          deferred: false, baseSha: args.baseSha, headSha: args.headSha };
      }
      if (action === 'gitlab.code') return { content: window.__flowFiles.find(item => item.path === args.path)?.content || '', path: args.path, ref: args.ref };
      if (action === 'claude.review' && guide) return structuredClone(guide);
      const result = await original(action, args);
      if (action === 'gitlab.mr') return { ...result, files: structuredClone(window.__flowFiles), ...(guide ? { guide } : {}), local: { mode: 'local-git', fileCount: files.length } };
      return result;
    };
  }, { files, guide });
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await expect(page.getByLabel('Diagram review comment')).toBeVisible();
}
async function choose(page, query) {
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await expect(page.getByLabel('Search review flows')).toBeFocused();
  await page.getByLabel('Search review flows').fill(query);
  await expect(page.getByLabel('Search review flows')).toHaveValue(query);
  await expect(page.getByRole('button', { name: /^Review flow / })).toHaveCount(1);
  await page.getByRole('button', { name: /^Review flow / }).first().click();
}
const selectFile = (page, path) => page.locator('.review-component-list').getByRole('button').filter({ hasText: path }).click();

test('A small single flow keeps the direct review UI without an extra chooser', async ({ page }) => {
  await installConnected(page);
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await expect(page.getByLabel('Choose review flow', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Dependency flow diagram' })).toBeVisible();
  await expect(page.locator('.review-component-list button')).toHaveCount(snapshot.files.length);
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('max', String(snapshot.files.length));
});

test('Flow picker searches files, preserves all changed-file coverage, and supports keyboard dismissal and next', async ({ page }) => {
  const files = groupedFiles(); await installFlows(page, files);
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await expect(page.getByLabel('Search review flows')).toBeFocused();
  const labels = await page.getByRole('button', { name: /^Review flow / }).evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  expect(labels.length).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Choose review flow', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Search review flows')).not.toBeVisible();
  const visited = new Set();
  for (const label of labels) {
    await page.getByLabel('Choose review flow', { exact: true }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    const text = await page.locator('.review-component-list').innerText();
    for (const item of files) if (text.includes(item.path)) visited.add(item.path);
  }
  expect([...visited].sort()).toEqual(files.map(item => item.path).sort());
  await choose(page, 'paymentsAction6.ts');
  await expect(page.locator('.review-component-list')).toContainText('paymentsAction6.ts');
  const before = await page.getByLabel('Choose review flow', { exact: true }).innerText();
  await page.getByLabel('Next review flow', { exact: true }).click();
  await expect(page.getByLabel('Choose review flow', { exact: true })).not.toHaveText(before);
  expect(await page.evaluate(() => window.__flowCalls.filter(call => ['gitlab.comment', 'gitlab.approve', 'claude.review'].includes(call.action)))).toEqual([]);
});

test('Shared files keep one canonical draft and viewed count while flow selection and source mode restore', async ({ page }) => {
  await installFlows(page, groupedFiles());
  await choose(page, 'orders'); await selectFile(page, sharedPath);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 2', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('One shared-file observation.');
  await page.getByLabel(`Mark ${sharedPath} as viewed`).check();
  await choose(page, 'payments'); await selectFile(page, sharedPath);
  await page.getByRole('button', { name: 'Select new line 2', exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('One shared-file observation.');
  await expect(page.getByLabel(`Mark ${sharedPath} as viewed`)).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: 'files viewed' })).toHaveText('1 / 15 files viewed');
  await choose(page, 'orders');
  await expect(page.locator('.visual-code-heading')).toContainText(sharedPath);
  await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('One shared-file observation.');
});

test('A validated checkpoint from a retained guide reveals another flow and appends to its canonical draft', async ({ page }) => {
  const target = 'src/payments/paymentsAction4.ts';
  const finding = { path: target, line: 3, title: 'Inspect the shared limit result', reason: 'Check the caller handles rejection.', severity: 'medium' };
  const guide = { summary: 'Retained review guide for this exact diff.', findings: [finding], readingOrder: [], dependencies: [], sequence: [],
    coverage: { includedFiles: 15, totalFiles: 15, diffOnly: true }, diffRefs: snapshot.mr.diff_refs, headSha: snapshot.mr.diff_refs.head_sha };
  await installFlows(page, groupedFiles(), { guide });
  await choose(page, 'payments'); await selectFile(page, target);
  await page.getByRole('button', { name: 'Select new line 3', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('My existing note.');
  await choose(page, 'orders');
  await page.getByRole('button', { name: 'All checks', exact: true }).click();
  await page.getByRole('button', { name: `Draft comment for ${finding.title}`, exact: true }).click();
  await expect(page.getByLabel('Choose review flow', { exact: true })).toContainText('payments');
  await expect(page.locator('.visual-code-heading')).toContainText(target);
  await expect(page.getByRole('button', { name: 'Open component paymentsAction4.ts', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue(`My existing note.\n\n${finding.title}\n${finding.reason}`);
  expect(await page.evaluate(() => window.__flowCalls.filter(call => ['gitlab.comment', 'gitlab.approve'].includes(call.action)))).toEqual([]);
});

test('The 125th changed file remains searchable and deferred local diff failure retries without losing its draft', async ({ page }) => {
  const files = Array.from({ length: 125 }, (_, index) => {
    const item = file(`src/area${String(Math.floor(index / 12)).padStart(2, '0')}/Change${String(index).padStart(3, '0')}.ts`, `export const change${index} = true;\n`);
    return index < 120 ? item : { ...item, fullRows: item.rows, fullDiff: item.diff, rows: [], diff: '', deferred: true };
  });
  const target = files.at(-1).path;
  await installFlows(page, files);
  await page.evaluate(path => { window.__flowDiffFailure = path; }, target);
  await choose(page, 'Change124.ts'); await selectFile(page, target);
  await expect(page.getByRole('progressbar', { name: 'Files viewed' })).toHaveAttribute('max', '125');
  await expect(page.getByRole('button', { name: 'Retry flow code', exact: true })).toBeVisible();
  await page.getByLabel('Diagram review comment').fill('Keep this note during local diff recovery.');
  await page.evaluate(() => { window.__flowDiffFailure = ''; });
  await page.getByRole('button', { name: 'Retry flow code', exact: true }).click();
  await expect(page.getByLabel('Component code')).toContainText('export const change124 = true;');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep this note during local diff recovery.');
  const reads = await page.evaluate(path => window.__flowCalls.filter(call => call.action === 'gitlab.diff' && call.args.path === path), target);
  expect(reads).toHaveLength(2);
  expect(reads.every(call => call.args.headSha === snapshot.mr.diff_refs.head_sha && call.args.baseSha === snapshot.mr.diff_refs.base_sha)).toBe(true);
});

test('Flow navigation stays keyboard reachable with diagram, code and AI together on a narrow dark window', async ({ page }) => {
  await installFlows(page, groupedFiles());
  await page.screenshot({ path: 'artifacts/review-flows-desktop.png' });
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await expect(page.getByLabel('Search review flows')).toBeFocused();
  await page.screenshot({ path: 'artifacts/review-flows-picker.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close context preview', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await page.setViewportSize({ width: 980, height: 650 });
  await page.locator('.attention-row').getByRole('button', { name: /Payment retry review/ }).click();
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await expect(page.getByLabel('Search review flows')).toBeFocused();
  await page.getByLabel('Search review flows').fill('paymentsAction6');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Review flow payments', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Choose review flow', { exact: true })).toContainText('payments');
  await expect(page.locator('.review-component-list')).toContainText('paymentsAction6');
  await page.getByRole('button', { name: 'Read paymentsAction6.ts', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector('.visual-map-panel').getBoundingClientRect();
    const node = document.querySelector('.diagram-node.selected').getBoundingClientRect();
    return node.width >= 100 && Math.min(panel.right, node.right, innerWidth) - Math.max(panel.left, node.left, 0) >= 100 &&
      Math.min(panel.bottom, node.bottom, innerHeight) - Math.max(panel.top, node.top, 0) >= 20;
  })).toBe(true);
  for (const selector of ['.visual-map-panel', '.visual-code-panel', '.ai-review-rail']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds.width).toBeGreaterThan(180);
    expect(Math.min(bounds.y + bounds.height, 650) - Math.max(bounds.y, 0)).toBeGreaterThan(100);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(981);
  }
  await page.screenshot({ path: 'artifacts/review-flows-narrow-dark.png' });
  expect(await page.evaluate(() => window.__flowCalls.filter(call => ['gitlab.comment', 'gitlab.approve', 'claude.review'].includes(call.action)))).toEqual([]);
});

test('A delayed AI response stays with its requested flow after the reviewer switches scopes', async ({ page }) => {
  await installFlows(page, groupedFiles());
  await choose(page, 'orders');
  await page.evaluate(refs => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action !== 'claude.review') return result;
      await new Promise(resolve => { window.finishFlowGuide = resolve; });
      return { summary: 'Orders-only delayed guide', diffRefs: refs, headSha: refs.head_sha,
        coverage: { scope: 'flow', totalFiles: args.paths.length, includedFiles: args.paths.length, mrTotalFiles: 15 },
        findings: [{ path: 'src/orders/ordersAction0.ts', line: 3, title: 'Inspect orders limit handling', reason: 'Check rejection propagation.', severity: 'medium' }],
        readingOrder: [], dependencies: [], sequence: [] };
    };
  }, snapshot.mr.diff_refs);
  await page.getByRole('button', { name: 'Generate AI guide', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.finishFlowGuide));
  await choose(page, 'payments');
  await expect(page.getByRole('status').filter({ hasText: 'Generating the AI guide for orders' })).toBeVisible();
  await page.evaluate(() => window.finishFlowGuide());
  await expect(page.getByRole('button', { name: 'Generate AI guide', exact: true })).toBeEnabled();
  await expect(page.locator('.ai-review-rail')).not.toContainText('Orders-only delayed guide');
  await choose(page, 'orders');
  await expect(page.locator('.ai-review-rail')).toContainText('Orders-only delayed guide');
  await expect(page.getByRole('button', { name: 'Draft comment for Inspect orders limit handling', exact: true })).toBeVisible();
  const calls = await page.evaluate(() => window.__flowCalls);
  const requests = calls.filter(call => call.action === 'claude.review');
  expect(requests).toHaveLength(1);
  expect(requests[0].args.paths).toContain(sharedPath);
  expect(requests[0].args.paths.some(path => path.startsWith('src/payments/'))).toBe(false);
  expect(calls.filter(call => ['gitlab.comment', 'gitlab.approve'].includes(call.action))).toEqual([]);
});

test('A delayed local diff from an old base cannot overwrite the refreshed same-head revision', async ({ page }) => {
  const files = groupedFiles();
  const target = 'src/payments/paymentsAction6.ts';
  const index = files.findIndex(item => item.path === target);
  files[index] = { ...files[index], fullRows: files[index].rows, fullDiff: files[index].diff, rows: [], diff: '', deferred: true };
  await installFlows(page, files);
  await page.evaluate(({ oldBase, oldPatch, newPatch }) => {
    const invoke = window.orbit.invoke;
    window.flowNewRevision = false;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === 'gitlab.mr' && window.flowNewRevision) {
        result.mr.diff_refs = { ...result.mr.diff_refs, base_sha: 'b'.repeat(40), start_sha: 'c'.repeat(40) };
      }
      if (action === 'gitlab.diff' && args.path === oldPatch.path) {
        if (args.baseSha === oldBase) {
          await new Promise(resolve => { window.finishOldFlowDiff = resolve; });
          window.oldFlowDiffReturned = true;
          return { ...oldPatch, deferred: false };
        }
        return { ...newPatch, deferred: false };
      }
      return result;
    };
  }, { oldBase: snapshot.mr.diff_refs.base_sha,
    oldPatch: file(target, 'export const obsoleteRevision = true;\n'),
    newPatch: file(target, 'export const currentRevision = true;\n') });
  await choose(page, 'payments'); await selectFile(page, target);
  await page.waitForFunction(() => Boolean(window.finishOldFlowDiff));
  await page.getByLabel('Diagram review comment').fill('Keep the canonical file note.');
  await page.evaluate(() => { window.flowNewRevision = true; });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByLabel('Component code')).toContainText('export const currentRevision = true;');
  await page.evaluate(() => window.finishOldFlowDiff());
  await page.waitForFunction(() => window.oldFlowDiffReturned);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByLabel('Component code')).toContainText('export const currentRevision = true;');
  await expect(page.getByLabel('Component code')).not.toContainText('obsoleteRevision');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep the canonical file note.');
  const reads = await page.evaluate(path => window.__flowCalls.filter(call => call.action === 'gitlab.diff' && call.args.path === path), target);
  expect(reads).toHaveLength(2);
  expect(reads.map(call => call.args.baseSha)).toEqual([snapshot.mr.diff_refs.base_sha, 'b'.repeat(40)]);
  expect(reads.every(call => call.args.headSha === snapshot.mr.diff_refs.head_sha)).toBe(true);
});
