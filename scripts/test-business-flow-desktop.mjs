import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mixedDemoSnapshot } from '../src/lib/mixed-demo-review.js';
import { prepareLocalReviewFixture } from './fixtures/local-git-review.mjs';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'worklane-business-native-'));
const original = mixedDemoSnapshot(); original.mr.project_id = 42; original.mr.iid = 7; original.mr.id = 99;
original.mr.web_url = 'https://gitlab.fixture.test/platform/payment-api/-/merge_requests/7';
const fixture = await prepareLocalReviewFixture({ root, directory: temp, snapshot: original });
const app = await electron.launch({ args: [fixture.bootstrap], env: { ...process.env, ORBIT_USER_DATA_DIR: temp } });
const evidence = { scope: 'Production Electron + actual immutable Git + synthetic HTTPS metadata/Claude', externalServicesTested: false, checks: [], consoleErrors: [] };
try {
  await app.evaluate(({ protocol }, { snapshot, cloneUrl }) => {
    global.__businessCalls = [];
    protocol.handle('https', async request => {
      const u = new URL(request.url);
      if (!u.hostname.endsWith('.fixture.test')) return new Response('', { status: 403 });
      let body; try { body = await request.json(); } catch {}
      global.__businessCalls.push({ path: u.pathname, method: request.method, body });
      let data;
      if (/\/diffs$|\/repository\/files\//.test(u.pathname)) return new Response('Code API forbidden', { status: 410 });
      if (u.pathname.endsWith('/user')) data = { id: 3, name: 'Reviewer' };
      else if (u.pathname.endsWith('/projects/42')) data = { id: 42, http_url_to_repo: cloneUrl };
      else if (u.pathname.endsWith('/merge_requests/7')) data = snapshot.mr;
      else if (u.pathname.endsWith('/merge_requests')) data = [snapshot.mr];
      else if (u.pathname.endsWith('/discussions')) data = [];
      else if (u.pathname.endsWith('/messages')) data = { model: 'claude-fixture', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ summary: 'Kafka source-scope fixture', findings: [], readingOrder: [], sequence: [], dependencies: [] }) }] };
      else return new Response('', { status: 404 });
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'x-next-page': '' } });
    });
  }, { snapshot: fixture.snapshot, cloneUrl: fixture.cloneUrl });
  const p = await app.firstWindow(); p.on('pageerror', e => evidence.consoleErrors.push(e.message));
  await p.evaluate(async () => {
    for (const service of ['gitlab','claude']) await window.orbit.invoke('config.save', { service, config: { url: `https://${service}.fixture.test`, token: 'synthetic-fixture-token', model: 'claude-fixture' } });
  });
  await p.getByLabel('Workspace data mode').selectOption('connected');
  await p.getByRole('button', { name: 'Code', exact: true }).click();
  await p.getByRole('button', { name: /Unify settlement API, Kafka delivery and reconciliation !7/ }).click();
  await expect(p.getByLabel('Current business flow')).toContainText('Kafka · SettlementConsumer.onCaptured()', { timeout: 30000 });
  evidence.checks.push('Native Git source discovers Kafka, API, schedule and core scopes');
  for (const role of ['consumer','domainservice','persistenceadapter','repository','dto','entity','model','port']) await expect(p.locator(`.architecture-layer[data-role="${role}"]`)).toHaveCount(1);
  evidence.checks.push('Native production rendering separates domain, storage boundaries and data contracts');
  await p.getByRole('button', { name: 'Generate AI guide', exact: true }).click();
  await expect(p.locator('.guide-summary')).toBeVisible();
  const prompt = await app.evaluate(() => JSON.parse(global.__businessCalls.find(c => c.path.endsWith('/messages')).body.messages[0].content));
  expect(prompt.scope.kind).toBe('method'); expect(prompt.apiFlow.kind).toBe('kafka');
  const code = prompt.files.find(f => f.path.endsWith('SettlementService.ts')).code;
  expect(code).toContain('async settle'); expect(code).not.toContain('async capture'); expect(code).not.toContain('async reconcile');
  expect(prompt.files.find(f => f.path.endsWith('SettlementEvent.ts')).code).toContain('eventVersion: 2');
  evidence.checks.push('Server-derived Claude scope contains Kafka methods and contracts, excluding other Service methods');
  const calls = await app.evaluate(() => global.__businessCalls);
  expect(calls.filter(c => c.method === 'POST' && !c.path.endsWith('/messages'))).toHaveLength(0);
  expect(calls.filter(c => /\/diffs$|\/repository\/files\//.test(c.path))).toHaveLength(0);
  evidence.checks.push('No remote code API requests and no automatic external writes');
  const rejected = await p.evaluate(async ({head,base}) => { try { await window.orbit.invoke('claude.review', {projectId:42,iid:7,headSha:head,baseSha:base,flowId:'kafka:forged'}); return false; } catch { return true; } }, fixture);
  expect(rejected).toBe(true);
  evidence.checks.push('A forged business flow cannot select arbitrary Claude source');
  await p.getByLabel('Choose review flow', { exact: true }).click();
  await p.getByRole('button', { name: 'Review flow Core · money.convertCurrency()', exact: true }).click();
  await expect(p.getByLabel('Methods in this business flow')).toContainText('roundMoney()');
  await expect(p.getByLabel('Current business flow')).toContainText('runtime entry not established');
  evidence.checks.push('Core functions remain reviewable without a fabricated runtime trigger');
  expect(evidence.consoleErrors).toEqual([]);
} finally {
  await fs.mkdir(path.join(root, 'research/business-flow-review'), { recursive: true });
  await fs.writeFile(path.join(root,'research/business-flow-review/native.json'), JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence));
  await app.close(); await fs.rm(temp, { recursive: true, force: true });
}
