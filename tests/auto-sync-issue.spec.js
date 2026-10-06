import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

async function openIssue(page) {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') });
  await installConnected(page);
  await page.evaluate(() => { window.__fixture.issue.fields.priority.id = '1'; });
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.getByRole('button', { name: 'PAY-382', exact: true }).click();
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
}
const inspector = page => page.getByLabel('Live issue inspector');
const issueReads = page => page.evaluate(() => window.__fixture.calls.filter(c => c.action === 'jira.issue').length);

test('issue auto-sync refreshes remote fields while preserving every pending field and editor focus', async ({ page }) => {
  await openIssue(page);
  await page.getByLabel('Jira due date').fill('2027-01-19');
  await page.getByLabel('Find Jira assignee').fill('Daniel');
  await page.getByRole('button', { name: 'Find people' }).click();
  await page.getByLabel('Jira assignee', { exact: true }).selectOption('daniel');
  await page.getByText('Sprint & priority', { exact: true }).click();
  await page.getByLabel('Jira priority', { exact: true }).selectOption('2');
  await page.getByLabel('Jira scrum board').selectOption('10');
  await page.getByLabel('Jira sprint', { exact: true }).selectOption('25');
  await page.getByLabel('Live Jira comment').fill('Keep my investigation draft while the issue changes.');
  const scroll = await inspector(page).locator('.live-inspector-body').evaluate(el => el.scrollTop);
  await page.evaluate(() => {
    window.__fixture.issue.fields.summary = 'Retry implementation updated by teammate';
    window.__fixture.issue.fields.duedate = '2028-03-02';
    window.__fixture.issue.fields.assignee = { accountId: 'sam', displayName: 'Sam Lee' };
  });
  const reads = await issueReads(page);
  await page.clock.fastForward(61000);
  await expect(inspector(page).getByRole('heading', { name: 'Retry implementation updated by teammate' })).toBeAttached();
  expect(await issueReads(page)).toBe(reads + 1);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2027-01-19');
  await expect(page.getByLabel('Jira assignee', { exact: true })).toHaveValue('daniel');
  await expect(page.getByLabel('Jira priority', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Jira sprint', { exact: true })).toHaveValue('25');
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('Keep my investigation draft while the issue changes.');
  await expect(page.getByLabel('Live Jira comment')).toBeFocused();
  expect(await inspector(page).locator('.live-inspector-body').evaluate(el => el.scrollTop)).toBe(scroll);
  expect(await page.evaluate(() => window.__fixture.calls.filter(c => ['jira.edit', 'jira.comment', 'jira.moveSprint', 'jira.transition'].includes(c.action)))).toEqual([]);
});

test('returning to the app refreshes stale issue data; pristine fields follow the server', async ({ page }) => {
  await openIssue(page);
  await page.evaluate(() => { window.__fixture.issue.fields.duedate = '2026-10-09'; });
  await page.clock.fastForward(20000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-09');
  const reads = await issueReads(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await issueReads(page)).toBe(reads);
});

test('sync failure retains the visible issue and retries after connectivity returns', async ({ page }) => {
  await openIssue(page);
  await page.getByLabel('Live Jira comment').fill('Draft survives a temporarily unavailable Jira.');
  await page.evaluate(() => window.__fixture.setFailure('jira.issue'));
  await page.clock.fastForward(61000);
  await expect(inspector(page).getByLabel('Automatic synchronization: Sync delayed · retrying automatically', { exact: true })).toBeAttached();
  await expect(inspector(page).getByRole('heading', { name: 'Payment retry implementation' })).toBeAttached();
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('Draft survives a temporarily unavailable Jira.');
  await page.context().setOffline(true);
  await expect(inspector(page).getByLabel('Automatic synchronization: Offline · keeping last data', { exact: true })).toBeAttached();
  const reads = await issueReads(page);
  await page.clock.fastForward(180000);
  expect(await issueReads(page)).toBe(reads);
  await page.evaluate(() => { window.__fixture.setFailure(''); window.__fixture.issue.fields.summary = 'Reconnected issue'; });
  await page.context().setOffline(false);
  await expect(inspector(page).getByRole('heading', { name: 'Reconnected issue' })).toBeAttached();
  await expect(inspector(page).getByLabel('Automatic synchronization: Auto-sync on', { exact: true })).toBeAttached();
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('Draft survives a temporarily unavailable Jira.');
});

test('slow pre-mutation sync cannot replace the confirmed comment', async ({ page }) => {
  await openIssue(page);
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture); let held = false;
    window.__fixture.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === 'jira.issue' && !held) {
        held = true;
        await new Promise(resolve => { window.releaseStaleIssue = resolve; });
      }
      return result;
    };
  });
  await page.clock.fastForward(61000);
  await page.waitForFunction(() => Boolean(window.releaseStaleIssue));
  await page.getByLabel('Live Jira comment').fill('Confirmed during pending automatic read.');
  await page.getByRole('button', { name: 'Post to Jira', exact: true }).click();
  await expect(inspector(page)).toContainText('Confirmed during pending automatic read.');
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('');
  await page.evaluate(() => window.releaseStaleIssue());
  await expect(inspector(page).locator('.component-comment')).toContainText('Confirmed during pending automatic read.');
  await expect(inspector(page).getByLabel('Automatic synchronization: Auto-sync on', { exact: true })).toBeAttached();
});

test('automatic issue reads pause while an external write is still pending', async ({ page }) => {
  await openIssue(page);
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      if (action === 'jira.comment') await new Promise(resolve => { window.finishIssueWrite = resolve; });
      return original(action, args);
    };
  });
  await page.getByLabel('Live Jira comment').fill('One deliberate comment.');
  await page.getByRole('button', { name: 'Post to Jira', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.finishIssueWrite));
  const reads = await issueReads(page);
  await page.clock.fastForward(180000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await issueReads(page)).toBe(reads);
  await page.evaluate(() => window.finishIssueWrite());
  await expect(page.getByLabel('Live Jira comment')).toHaveValue('');
  await page.getByLabel('Jira due date').fill('2026-10-09');
  await expect(page.getByRole('button', { name: 'Save due date in Jira' })).toBeEnabled();
  expect(await issueReads(page)).toBe(reads + 1);
});

test('related GitLab and Confluence mentions refresh quietly and keep previous results on failure', async ({ page }) => {
  await openIssue(page);
  const related = page.getByLabel('Related work preview');
  await expect(related.getByRole('button', { name: /Payment Retry Policy/ })).toBeAttached();
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === 'confluence.search') result.results[0].content.title = 'Updated retry policy mention';
      return result;
    };
  });
  await page.clock.fastForward(61000);
  await expect(related.getByRole('button', { name: /Updated retry policy mention/ })).toBeAttached();
  await page.evaluate(() => window.__fixture.setFailure('confluence.search'));
  await page.clock.fastForward(61000);
  await expect(related.getByRole('alert')).toContainText('Previous results are still shown.');
  await expect(related.getByRole('button', { name: /Updated retry policy mention/ })).toBeAttached();
});


test('an initial Jira outage recovers automatically without closing the inspector', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') });
  await installConnected(page);
  await page.evaluate(() => window.__fixture.setFailure('jira.issue'));
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.getByRole('button', { name: 'PAY-382', exact: true }).click();
  await expect(inspector(page).getByRole('alert')).toContainText('Fixture service unavailable');
  await page.evaluate(() => window.__fixture.setFailure(''));
  await page.clock.fastForward(61000);
  await expect(page.getByLabel('Jira due date')).toHaveValue('2026-10-04');
  await expect(inspector(page).getByRole('alert')).toHaveCount(0);
});
