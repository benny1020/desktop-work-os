import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

const openIssue = page => page.locator('.live-inbox').getByRole('button', { name: /PAY-\d+ Payment retry implementation/ }).click();
async function editFields(page) {
  await page.getByLabel('Jira due date').fill('2026-10-12');
  await page.getByLabel('Find Jira assignee').fill('Daniel');
  await page.getByRole('button', { name: 'Find people', exact: true }).click();
  await page.getByLabel('Jira assignee', { exact: true }).selectOption('daniel');
}
async function roundTrip(page, kind = 'wiki') {
  await page.getByRole('button', { name: kind === 'wiki' ? /Payment Retry Policy/ : /!7 PAY-382 Payment retry review/ }).click();
  if (kind === 'wiki') await expect(page.locator('.remote-document')).toContainText('Bound retries');
  else await expect(page.getByRole('group', { name: 'Dependency flow diagram' })).toBeVisible();
  await page.getByLabel('Back in context').click();
  await expect(page.getByLabel('Jira due date')).toBeVisible();
}

test.beforeEach(async ({ page }) => installConnected(page));

test('Home issue field edits and comment survive wiki and MR round trips, with explicit discard', async ({ page }) => {
  await openIssue(page); await editFields(page);
  await page.getByLabel('Live Jira comment').fill('Preserve my evidence note.');
  for (const kind of ['wiki', 'mr']) {
    await roundTrip(page, kind);
    await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
    await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('daniel');
    await expect(page.getByLabel('Live Jira comment')).toHaveValue('Preserve my evidence note.');
    await expect(page.getByRole('button', { name: 'Discard field changes' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('alex');
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('Preserve my evidence note.');
  await roundTrip(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === 'jira.edit'))).toEqual([]);
});

test('Field drafts are isolated by issue and Jira account, and stay out of browser storage', async ({ page }) => {
  await openIssue(page); await editFields(page);
  await page.getByLabel('Close context preview').click();
  await page.evaluate(() => { window.__fixture.issue.key = 'PAY-383'; });
  await page.getByRole('button', { name: 'Refresh work', exact: true }).click();
  await openIssue(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
  await page.getByLabel('Jira due date').fill('2026-10-15');
  await page.getByLabel('Close context preview').click();
  await page.evaluate(() => { window.__fixture.issue.key = 'PAY-382'; });
  await page.getByRole('button', { name: 'Refresh work', exact: true }).click();
  await openIssue(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  await page.getByLabel('Close context preview').click();
  await page.evaluate(() => { window.__fixture.configs.jira.email = 'other@example.test'; });
  await openIssue(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('alex');
  await page.getByLabel('Close context preview').click();
  await page.evaluate(() => { window.__fixture.configs.jira.email = 'reviewer@example.test'; });
  await openIssue(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  const storage = await page.evaluate(() => Object.entries(localStorage));
  expect(storage.some(([key, value]) => /2026-10-12|daniel|other@example/.test(value))).toBe(false);
});

test('Changed Jira fields retain the pending draft and warn before an explicit overwrite', async ({ page }) => {
  await openIssue(page); await editFields(page);
  await page.getByRole('button', { name: /Payment Retry Policy/ }).click();
  await page.evaluate(() => { window.__fixture.issue.fields.duedate = '2026-10-20'; window.__fixture.issue.fields.assignee = { accountId: 'robin', displayName: 'Robin' }; });
  await page.getByLabel('Back in context').click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('daniel');
  await expect(page.getByRole('alert')).toContainText('Jira changed assignee, due date');
  await expect(page.getByLabel('Assignee conflict')).toContainText('Jira now: Robin');
  await expect(page.getByLabel('Assignee conflict')).toContainText('Your draft: Daniel Park');
  await expect(page.getByLabel('Due date conflict')).toContainText('Jira now: 2026-10-20');
  await expect(page.getByLabel('Due date conflict')).toContainText('Your draft: 2026-10-12');
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-20');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('robin');
});

test('Accepted field writes clear only that draft, including when the following read fails', async ({ page }) => {
  await openIssue(page); await editFields(page);
  await page.evaluate(() => window.__fixture.setFailure('jira.issue'));
  await page.getByRole('button', { name: 'Save due date in Jira' }).click();
  await expect(page.getByRole('alert')).toContainText('Issue refresh failed');
  await expect(page.getByRole('button', { name: 'Save due date in Jira' })).toBeDisabled();
  await page.evaluate(() => window.__fixture.setFailure(''));
  await roundTrip(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('daniel');
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('alex');
});

test('A write accepted after leaving the issue does not resurrect its submitted draft', async ({ page }) => {
  await openIssue(page);
  await page.getByLabel('Jira due date').fill('2026-10-12');
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action === 'jira.edit') await new Promise(resolve => { window.acceptFieldWrite = resolve; });
      return original(action, args);
    };
  });
  await page.getByRole('button', { name: 'Save due date in Jira' }).click();
  await page.getByRole('button', { name: /Payment Retry Policy/ }).click();
  await page.evaluate(() => window.acceptFieldWrite());
  await expect.poll(() => page.evaluate(() => window.__fixture.issue.fields.duedate)).toBe('2026-10-12');
  await page.getByLabel('Back in context').click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  await expect(page.getByRole('button', { name: 'Discard field changes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save due date in Jira' })).toBeDisabled();
});

test('Newer edits typed during an accepted write remain a distinct pending draft', async ({ page }) => {
  await openIssue(page);
  await page.getByLabel('Jira due date').fill('2026-10-12');
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action === 'jira.edit') await new Promise(resolve => { window.acceptFieldWrite = resolve; });
      return original(action, args);
    };
  });
  await page.getByRole('button', { name: 'Save due date in Jira' }).click();
  await page.getByLabel('Jira due date').fill('2026-10-15');
  await page.evaluate(() => window.acceptFieldWrite());
  await expect(page.getByRole('button', { name: 'Save due date in Jira' })).toBeEnabled();
  await roundTrip(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-15');
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
});

test('Priority edits survive related navigation without issuing a write', async ({ page }) => {
  await openIssue(page);
  await page.getByText('Sprint & priority', { exact: true }).click();
  await page.getByLabel('Jira priority').selectOption('2');
  await roundTrip(page);
  await page.getByText('Sprint & priority', { exact: true }).click();
  await expect(page.getByLabel('Jira priority')).toHaveValue('2');
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira priority')).toHaveValue('');
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === 'jira.edit'))).toEqual([]);
});

test('A failed field write retains the draft for returning to the issue and retrying', async ({ page }) => {
  await openIssue(page); await editFields(page);
  await page.evaluate(() => window.__fixture.setFailure('jira.edit'));
  await page.getByRole('button', { name: 'Save due date in Jira' }).click();
  await expect(page.getByRole('alert')).toContainText('Fixture service unavailable');
  await roundTrip(page);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
  await page.evaluate(() => window.__fixture.setFailure(''));
  await page.getByRole('button', { name: 'Save due date in Jira' }).click();
  await expect(page.getByRole('button', { name: 'Save due date in Jira' })).toBeDisabled();
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-12');
});


test('Conflict comparisons show priority names and explicit empty remote values after context return', async ({ page }) => {
  await page.evaluate(() => { window.__fixture.issue.fields.priority = { id: "1", name: "High" }; });
  await openIssue(page); await editFields(page);
  await page.getByText('Sprint & priority', { exact: true }).click();
  await page.getByLabel('Jira priority').selectOption('2');
  await page.getByRole('button', { name: /Payment Retry Policy/ }).click();
  await page.evaluate(() => {
    window.__fixture.issue.fields.duedate = null;
    window.__fixture.issue.fields.assignee = null;
    window.__fixture.issue.fields.priority = { id: "3", name: "Low" };
  });
  await page.getByLabel('Back in context').click();
  await expect(page.getByLabel('Assignee conflict')).toContainText('Jira now: Unassigned');
  await expect(page.getByLabel('Assignee conflict')).toContainText('Your draft: Daniel Park');
  await expect(page.getByLabel('Due date conflict')).toContainText('Jira now: No due date');
  await expect(page.getByLabel('Due date conflict')).toContainText('Your draft: 2026-10-12');
  await expect(page.getByLabel('Priority conflict')).toContainText('Jira now: Low');
  await expect(page.getByLabel('Priority conflict')).toContainText('Your draft: Medium');
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Field conflicts')).toHaveCount(0);
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Jira due date')).toHaveValue('');
  await page.getByText('Sprint & priority', { exact: true }).click();
  await expect(page.getByLabel('Jira priority')).toHaveValue('3');
  await expect(page.getByLabel('Jira priority').locator('option:checked')).toHaveText('Low · current');
  await expect(page.getByLabel('Jira priority').locator('option[value="3"]')).toHaveJSProperty('disabled', true);
  await expect(page.getByRole('button', { name: 'Save priority in Jira' })).toBeDisabled();
  await page.getByLabel('Jira priority').selectOption('1');
  await expect(page.getByRole('button', { name: 'Save priority in Jira' })).toBeEnabled();
  await expect(page.getByLabel('Jira priority').locator('option[value="3"]')).toHaveJSProperty('disabled', true);
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === 'jira.edit'))).toEqual([]);
});


test('Restored priority drafts excluded by updated metadata stay visible and cannot be saved', async ({ page }) => {
  await page.evaluate(() => { window.__fixture.issue.fields.priority = { id: '1', name: 'High' }; });
  await openIssue(page);
  await page.getByText('Sprint & priority', { exact: true }).click();
  await page.getByLabel('Jira priority').selectOption('2');
  await page.getByRole('button', { name: /Payment Retry Policy/ }).click();
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = (action, args) => action === 'jira.editMetadata' ? Promise.resolve({ fields: { priority: { allowedValues: [{ id: '1', name: 'High' }] } } }) : original(action, args);
  });
  await page.getByLabel('Back in context').click();
  await page.getByText('Sprint & priority', { exact: true }).click();
  await expect(page.getByLabel('Jira priority')).toHaveValue('2');
  await expect(page.getByLabel('Jira priority').locator('option:checked')).toHaveText('Medium · unavailable');
  await expect(page.getByLabel('Jira priority').locator('option[value="2"]')).toHaveJSProperty('disabled', true);
  await expect(page.getByRole('status').filter({ hasText: 'This priority is no longer available' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save priority in Jira' })).toBeDisabled();
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === 'jira.edit'))).toEqual([]);
  await page.getByRole('button', { name: 'Discard field changes' }).click();
  await expect(page.getByLabel('Jira priority')).toHaveValue('1');
  await expect(page.getByRole('status').filter({ hasText: 'This priority is no longer available' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save priority in Jira' })).toBeDisabled();
});
