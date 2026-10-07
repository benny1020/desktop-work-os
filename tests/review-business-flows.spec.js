import { test, expect } from '@playwright/test';
const open = async page => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Unify settlement API, Kafka delivery and reconciliation' }).getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByLabel('Current business flow')).toContainText('Kafka · SettlementConsumer.onCaptured()');
};
const choose = async (page, title) => {
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.getByRole('button', { name: `Review flow ${title}`, exact: true }).click();
};
test('Kafka, scheduled, API and core scopes keep one coherent method path and independent completion', async ({page}) => {
  await open(page);
  await expect(page.getByLabel('Current business flow')).toContainText('payments.captured.v2');
  await page.getByLabel('Mark business flow reviewed').check();
  await choose(page, 'Scheduled · ReconciliationJob.reconcile()');
  await expect(page.getByLabel('Mark business flow reviewed')).not.toBeChecked();
  await page.getByRole('button', { name: 'Read SettlementService.ts', exact: true }).click();
  await expect(page.getByLabel('Methods in this business flow')).toContainText('reconcile()');
  await expect(page.getByLabel('Methods in this business flow')).not.toContainText('settle()');
  await choose(page, 'Core · money.convertCurrency()');
  await expect(page.getByLabel('Current business flow')).toContainText('runtime entry not established');
  await expect(page.getByLabel('Methods in this business flow')).toContainText('roundMoney()');
  await choose(page, 'POST /settlements/capture');
  await expect(page.getByLabel('Current API flow')).toContainText('Request entry');
  await choose(page, 'Kafka · SettlementConsumer.onCaptured()');
  await expect(page.getByLabel('Mark business flow reviewed')).toBeChecked();
});
test('Kafka dependency graph separates domain, adapters, persistence and data contracts; source-line draft stays shared', async ({page}) => {
  await open(page);
  await page.getByRole('button', { name: 'Calls + types', exact: true }).click();
  for (const role of ['consumer','service','domainservice','domain','persistenceadapter','repository','producer','port','dto','entity','model']) await expect(page.locator(`.architecture-layer[data-role="${role}"]`)).toHaveCount(1);
  await page.getByRole('button', { name: 'Open component SettlementPersistenceAdapter.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 6', exact: true }).click();
  await page.getByLabel('Diagram review comment').fill('멱등성 조회와 insert 사이의 경쟁 조건을 확인해 주세요.');
  await choose(page, 'Scheduled · ReconciliationJob.reconcile()');
  await page.getByRole('button', { name: 'Open component SettlementPersistenceAdapter.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Select source line 6', exact: true }).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('멱등성 조회와 insert 사이의 경쟁 조건을 확인해 주세요.');
  await choose(page, 'Kafka · SettlementConsumer.onCaptured()');
  await page.locator('.api-contracts summary').click();
  await page.locator('.api-contracts').getByRole('button', { name: 'SettlementEvent.ts', exact: true }).click();
  await expect(page.getByLabel('Component code')).toContainText('eventVersion: 2');
  await page.getByRole('tab', { name: 'Sequence', exact: true }).click();
  await expect(page.locator('.sequence-svg')).not.toContainText('SettlementEvent');
});
test('Kafka sample AI guide uses the selected source scope while topology remains source-derived', async ({page}) => {
  await open(page);
  const nodes = await page.locator('.dependency-svg [data-architecture-role]').count();
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await expect(page.locator('.guide-summary')).toBeVisible();
  await expect(page.getByRole('button', { name: /^high priority 동시 Kafka 재전달에서 중복 저장이 가능한가요\?/ })).toBeVisible();
  await expect(page.locator('.dependency-svg [data-architecture-role]')).toHaveCount(nodes);
  await choose(page, 'Scheduled · ReconciliationJob.reconcile()');
  await page.getByRole('button', { name: 'Preview AI guide', exact: true }).click();
  await expect(page.getByRole('button', { name: /^high priority 동시 Kafka 재전달에서 중복 저장이 가능한가요\?/ })).toHaveCount(0);
});
test('business flows remain readable in dark mode and a narrow window without page overflow', async ({page}) => {
  await open(page);
  await page.getByLabel('Collapse sidebar', { exact: true }).click();
  await page.getByLabel('Toggle theme', { exact: true }).click();
  await page.setViewportSize({ width: 980, height: 650 });
  await expect(page.getByRole('button', { name: 'Business flows · 4', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await choose(page, 'Core · money.convertCurrency()');
  await expect(page.getByLabel('Current business flow')).toContainText('convertCurrency');
});

test('selecting a repository method chooses its matching incoming call instead of the first class call', async ({page}) => {
  await open(page);
  await page.getByRole('button', { name:'Open component SettlementRepository.ts', exact:true }).click();
  await page.getByRole('button', { name:'Select source line 7', exact:true }).click();
  await page.getByRole('tab', { name:'Sequence', exact:true }).click();
  await expect(page.getByLabel('Sequence interaction').locator('option:checked')).toContainText('SettlementPersistenceAdapter.ts:10');
  await expect(page.locator('.sequence-label')).toContainText('save()');
  await expect(page.getByLabel('Component code')).toContainText('this.db.$transaction');
});

test('Kafka review restores unchanged domain context, selected source line and private draft after Home', async ({page}) => {
  await open(page);
  await page.getByRole('button', {name:'Open component SettlementDomain.ts',exact:true}).click();
  await page.getByRole('button', {name:'Select source line 4',exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Keep the unchanged settlement fee invariant in review context.');
  await expect(page.getByRole('button', {name:'Diff',exact:true})).toBeDisabled();
  await page.getByRole('button', {name:'Home',exact:true}).click();
  await page.getByRole('button', {name:'Code',exact:true}).click();
  await page.getByRole('row').filter({hasText:'Unify settlement API, Kafka delivery and reconciliation'}).getByRole('button', {name:'Review',exact:true}).click();
  await expect(page.getByLabel('Current business flow')).toContainText('Kafka');
  await expect(page.locator('.visual-code-heading')).toContainText('SettlementDomain.ts');
  await expect(page.getByRole('button', {name:'Select source line 4',exact:true})).toHaveClass(/selected/);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep the unchanged settlement fee invariant in review context.');
});

test('Calls-first diagram reveals type references on demand while code and draft stay in context', async ({page}) => {
  await open(page);
  await expect(page.locator('.dependency-edge')).toHaveCount(6);
  await expect(page.locator('.diagram-node')).toHaveCount(7);
  await expect(page.getByRole('group', {name:'Diagram relationships'})).toContainText('6 type links hidden');
  await page.getByRole('button', {name:'Open component SettlementPersistenceAdapter.ts',exact:true}).click();
  await page.getByRole('button', {name:'Select source line 9',exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Keep this source-line draft while revealing contracts.');
  await page.getByRole('button', {name:'Calls + types',exact:true}).click();
  await expect(page.locator('.dependency-edge')).toHaveCount(12);
  await expect(page.locator('.dependency-edge.type')).toHaveCount(6);
  await expect(page.locator('.diagram-node')).toHaveCount(12);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep this source-line draft while revealing contracts.');
  await expect(page.locator('.code-provenance')).toContainText('Selected new line 9');
  await page.getByRole('button', {name:'Calls',exact:true}).click();
  await expect(page.locator('.dependency-edge')).toHaveCount(6);
  await expect(page.locator('.code-provenance')).toContainText('Selected new line 9');
  await page.getByRole('button', {name:'Calls + types',exact:true}).click();
  await page.locator('.dependency-edge.type').first().press('Enter');
  await expect(page.locator('.visual-code-heading')).toContainText('SettlementConsumer.ts');
  await expect(page.locator('.code-provenance')).toContainText('Selected new line 3');
});
