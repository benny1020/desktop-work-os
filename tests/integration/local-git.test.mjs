import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLocalGitStore } = require('../../electron/local-git.cjs');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'worklane-local-git-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'remote'); await fs.mkdir(source); git(source, 'init', '-b', 'main');
  await fs.writeFile(path.join(source, 'service.js'), 'export const retry = 1;\n');
  await fs.writeFile(path.join(source, 'deleted.js'), 'remove me\n');
  await fs.writeFile(path.join(source, 'old-name.js'), 'export const preserveThisContentForRename = true;\n');
  await fs.writeFile(path.join(source, ':(glob)*.js'), 'literal path\n');
  git(source, 'add', '.'); git(source, 'commit', '-m', 'base'); const base = git(source, 'rev-parse', 'HEAD');
  git(source, 'switch', '-c', 'feature/retry');
  await fs.writeFile(path.join(source, 'service.js'), 'export const retry = 3;\n');
  await fs.unlink(path.join(source, 'deleted.js'));
  await fs.rename(path.join(source, 'old-name.js'), path.join(source, 'new-name.js'));
  await fs.writeFile(path.join(source, 'new.js'), 'export const added = true;\n');
  await fs.writeFile(path.join(source, 'binary.dat'), Buffer.from([0,1,2]));
  await fs.symlink('/etc/passwd', path.join(source, 'link'));
  git(source, 'add', '.'); git(source, 'commit', '-m', 'feature'); const head = git(source, 'rev-parse', 'HEAD');
  git(source, 'update-ref', 'refs/merge-requests/7/head', head);
  const state = { config: { url: 'https://gitlab.example.test', token: 'SECRET-FIXTURE-TOKEN' }, transportCalls: 0, offline: false };
  const directory = path.join(root, 'cache');
  const create = () => createLocalGitStore({ directory, getConfig: () => state.config, trustedTransport: () => { state.transportCalls++; return state.offline ? path.join(root, 'unavailable') : source; } });
  const store = create();
  const request = { projectId: 42, iid: 7, repoUrl: 'https://gitlab.example.test/team/project.git', refs: { base_sha: base, head_sha: head }, sourceBranch: 'feature/retry' };
  return { root, source, directory, state, store, request, base, head, create };
}

test('clones immutable MR head into an isolated checkout and returns accurate changes', async t => {
  const f = await fixture(t); const result = await f.store.snapshot(f.request);
  assert.equal(result.local.mode, 'local-git'); assert.equal(result.local.headSha, f.head);
  assert.equal(git(result.local.worktreePath, 'rev-parse', 'HEAD'), f.head);
  assert.equal(await fs.readFile(path.join(result.local.worktreePath, 'service.js'), 'utf8'), 'export const retry = 3;\n');
  assert.equal(result.files.find(v => v.new_path === 'deleted.js').deleted_file, true);
  assert.equal(result.files.find(v => v.new_path === 'new-name.js').renamed_file, true);
  assert.equal(result.files.find(v => v.new_path === 'new.js').new_file, true);
  assert.equal(result.files.find(v => v.new_path === 'binary.dat').binary, true);
  assert.match(result.files.find(v => v.new_path === 'service.js').diff, /\+export const retry = 3/);
  assert.equal(git(f.source, 'branch', '--show-current'), 'feature/retry');
});

test('durable snapshots and files work offline after a new store instance', async t => {
  const f = await fixture(t); await f.store.snapshot(f.request); f.state.offline = true;
  const store = f.create(); const cached = await store.snapshot(f.request); assert.equal(cached.local.cacheHit, true);
  const current = await store.readFile({ projectId: 42, ref: f.head, path: 'service.js' });
  const before = await store.readFile({ projectId: 42, ref: f.base, path: 'service.js' });
  assert.equal(current.content, 'export const retry = 3;\n'); assert.equal(before.content, 'export const retry = 1;\n');
  assert.equal((await store.readFile({ projectId: 42, ref: f.head, path: 'link' })).content, '/etc/passwd');
  assert.equal((await store.readFile({ projectId: 42, ref: f.head, path: ':(glob)*.js' })).content, 'literal path\n');
});

test('new head is checked out separately without corrupting previous review objects', async t => {
  const f = await fixture(t); const first = await f.store.snapshot(f.request);
  await fs.writeFile(path.join(f.source, 'service.js'), 'export const retry = 5;\n'); git(f.source, 'add', '.'); git(f.source, 'commit', '-m', 'next');
  const next = git(f.source, 'rev-parse', 'HEAD'); git(f.source, 'update-ref', 'refs/merge-requests/7/head', next);
  const second = await f.store.snapshot({ ...f.request, refs: { base_sha: f.base, head_sha: next }, refresh: true });
  assert.notEqual(first.local.worktreePath, second.local.worktreePath);
  assert.equal((await f.store.readFile({ projectId: 42, ref: f.head, path: 'service.js' })).content, 'export const retry = 3;\n');
  assert.equal((await f.store.readFile({ projectId: 42, ref: next, path: 'service.js' })).content, 'export const retry = 5;\n');
});

test('concurrent loads serialize repository mutations and reuse the finished snapshot', async t => {
  const f = await fixture(t); const results = await Promise.all([f.store.snapshot(f.request), f.store.snapshot(f.request), f.store.snapshot(f.request)]);
  assert.equal(results.filter(r => r.local.cacheHit).length, 2);
  assert.equal(new Set(results.map(r => r.local.worktreePath)).size, 1);
});

test('rejects arbitrary transports, traversal and mutable refs', async t => {
  const f = await fixture(t);
  for (const repoUrl of ['file:///etc/passwd', 'https://other.test/x.git', 'https://token@gitlab.example.test/x.git', 'https://gitlab.example.test/x.git?token=secret']) {
    await assert.rejects(f.store.snapshot({ ...f.request, repoUrl }), /HTTPS|configured/);
  }
  await assert.rejects(f.store.snapshot({ ...f.request, refs: { base_sha: 'main', head_sha: f.head } }), /immutable/);
  for (const invalid of ['../secret', '/etc/passwd', 'a/../../x', 'a\\b', 'a\0b']) await assert.rejects(f.store.readFile({ projectId: 42, ref: f.head, path: invalid }), /path/);
  await assert.rejects(f.store.readFile({ projectId: '../42', ref: f.head, path: 'a' }), /numeric/);
});

test('credential rotation isolates old source and leaves no persisted token', async t => {
  const f = await fixture(t); const first = await f.store.snapshot(f.request);
  f.state.config = { ...f.state.config, token: 'NEW-FIXTURE-TOKEN' };
  await assert.rejects(f.store.readFile({ projectId: 42, ref: f.head, path: 'service.js' }), /not cached/);
  const second = await f.store.snapshot(f.request); assert.notEqual(first.local.worktreePath, second.local.worktreePath);
  async function scan(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) await scan(p); else if (entry.isFile()) { const text = (await fs.readFile(p)).toString(); assert.ok(!text.includes('SECRET-FIXTURE-TOKEN')); assert.ok(!text.includes('NEW-FIXTURE-TOKEN')); } } }
  await scan(f.directory);
});

test('binary and oversized sources report preview limitations without reading filesystem links', async t => {
  const f = await fixture(t); await fs.writeFile(path.join(f.source, 'large.txt'), 'x'.repeat(600000)); git(f.source, 'add', '.'); git(f.source, 'commit', '-m', 'large');
  const head = git(f.source, 'rev-parse', 'HEAD'); git(f.source, 'update-ref', 'refs/merge-requests/7/head', head);
  const result = await f.store.snapshot({ ...f.request, refs: { base_sha: f.base, head_sha: head } });
  assert.equal(result.truncated, true); assert.equal(result.files.find(v => v.new_path === 'large.txt').unavailable, true);
  await assert.rejects(f.store.readFile({ projectId: 42, ref: head, path: 'large.txt' }), /limit/);
  await assert.rejects(f.store.readFile({ projectId: 42, ref: head, path: 'binary.dat' }), /Binary/);
});

test('literal pathspec characters never mix patches from other changed files', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, ':(glob)*.js'), 'changed literal path\n');
  await fs.writeFile(path.join(f.source, '[service].js'), 'another isolated change\n');
  git(f.source, 'add', '.'); git(f.source, 'commit', '-m', 'literal names'); const head = git(f.source, 'rev-parse', 'HEAD');
  git(f.source, 'update-ref', 'refs/merge-requests/7/head', head);
  const result = await f.store.snapshot({ ...f.request, refs: { base_sha: f.base, head_sha: head } });
  const literal = result.files.find(v => v.new_path === ':(glob)*.js');
  assert.match(literal.diff, /changed literal path/); assert.doesNotMatch(literal.diff, /retry =|another isolated/);
  assert.match(result.files.find(v => v.new_path === '[service].js').diff, /another isolated change/);
});

test('account changes during source loading prevent stale result delivery', async t => {
  const f = await fixture(t);
  const store = createLocalGitStore({ directory: f.directory, getConfig: () => f.state.config, trustedTransport: () => {
    f.state.config = { ...f.state.config, token: 'ROTATED-IN-FLIGHT' }; return f.source;
  } });
  await assert.rejects(store.snapshot(f.request), /account changed/);
});

test('a missing cached checkout is recreated from local objects while offline', async t => {
  const f = await fixture(t); const first = await f.store.snapshot(f.request);
  await fs.rm(first.local.worktreePath, { recursive: true, force: true }); f.state.offline = true;
  const cached = await f.create().snapshot(f.request);
  assert.equal(cached.local.cacheHit, true);
  assert.equal(git(cached.local.worktreePath, 'rev-parse', 'HEAD'), f.head);
  assert.equal(await fs.readFile(path.join(cached.local.worktreePath, 'service.js'), 'utf8'), 'export const retry = 3;\n');
});

test('a timed-out real Git transport kills descendants and permits a clean retry', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t); const pids = path.join(f.root, 'transport-pids');
  const wrapper = path.join(f.root, 'git-stalled-transport.sh');
  const executable = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  // Keep the pipes open after a real Git fetch with a stalled child, like remote-https/index-pack.
  await fs.writeFile(wrapper, '#!/bin/sh\necho "$@" >> "' + path.join(f.root, 'operations') + '"\nfor arg do\nif [ "$arg" = fetch ]; then\n"' + executable + '" "$@" &\necho $! >> "' + pids + '"\nsleep 30 &\necho $! >> "' + pids + '"\nwait\nexit 0\nfi\ndone\nexec "' + executable + '" "$@"\n', { mode: 0o700 });
  const store = createLocalGitStore({ directory: f.directory, getConfig: () => f.state.config, trustedTransport: () => f.source, trustedGitExecutable: wrapper, commandTimeoutMs: 3000 });
  const start = Date.now();
  await assert.rejects(store.snapshot(f.request), /timed out/);
  assert.ok(Date.now() - start < 8000, 'transport timeout must reject without waiting for the 30-second child');
  const children = (await fs.readFile(pids, 'utf8').catch(async error => { console.log(await fs.readFile(path.join(f.root, 'operations'), 'utf8')); throw error; })).trim().split('\n').map(Number);
  assert.ok(children.length >= 2, 'real Git fetch and the stalled helper child were started');
  for (const pid of children) {
    // macOS/Linux may briefly retain reparented zombies; neither has live pipes or locks.
    let state = '';
    try { state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).trim(); } catch { /* Gone. */ }
    assert.ok(!state || state.startsWith('Z'), 'Git descendant must not remain running: ' + pid + ' ' + state);
  }
  await fs.writeFile(wrapper, '#!/bin/sh\nexec "' + executable + '" "$@"\n', { mode: 0o700 });
  const retry = await store.snapshot(f.request);
  assert.equal(retry.local.headSha, f.head);
});
