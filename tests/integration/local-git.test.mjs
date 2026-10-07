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

test('the complete large MR manifest remains discoverable and deferred flow patches load offline', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 130; i++) await fs.writeFile(path.join(f.source, `a-${String(i).padStart(3, '0')}.js`), `export const flow${i} = ${i};\n`);
  await fs.rename(path.join(f.source, 'new-name.js'), path.join(f.source, 'z-late-renamed.js'));
  await fs.appendFile(path.join(f.source, 'z-late-renamed.js'), '// kept\n');
  git(f.source, 'add', '.');
  git(f.source, 'update-index', '--add', '--cacheinfo', `160000,${f.head},z-submodule`);
  git(f.source, 'commit', '-m', 'large MR with another review flow');
  const head = git(f.source, 'rev-parse', 'HEAD'); git(f.source, 'update-ref', 'refs/merge-requests/7/head', head);
  const result = await f.store.snapshot({ ...f.request, refs: { base_sha: f.base, head_sha: head } });
  const count = git(f.source, 'diff', '--name-only', '-z', f.base, head).split('\0').filter(Boolean).length;
  assert.equal(result.files.length, count); assert.equal(result.local.fileCount, count);
  assert.equal(result.files.filter(v => !v.deferred).length, 120);
  assert.equal(result.files.find(v => v.path === 'a-129.js').deferred, true);
  assert.equal(result.files.find(v => v.path === 'z-late-renamed.js').renamed_file, true);
  assert.equal(result.files.find(v => v.path === 'z-late-renamed.js').deferred, true);
  f.state.offline = true; const transports = f.state.transportCalls;
  const args = { projectId: 42, baseSha: f.base, headSha: head };
  const later = await f.store.readDiff({ ...args, path: 'a-129.js' });
  assert.equal(later.deferred, false); assert.equal(later.unavailable, false); assert.match(later.diff, /flow129/);
  const rename = await f.store.readDiff({ ...args, path: 'z-late-renamed.js' });
  assert.equal(rename.old_path, 'old-name.js'); assert.equal(rename.renamed_file, true); assert.match(rename.diff, /\+\/\/ kept/);
  const removed = await f.store.readDiff({ ...args, path: 'deleted.js' });
  assert.equal(removed.deleted_file, true); assert.match(removed.diff, /-remove me/);
  const submodule = await f.store.readDiff({ ...args, path: 'z-submodule' });
  assert.equal(submodule.unavailable, true); assert.match(submodule.unavailableReason, /Submodule/);
  await assert.rejects(f.store.readDiff({ ...args, path: ':(glob)*.js' }), /not in this revision diff/);
  await assert.rejects(f.store.readDiff({ ...args, path: '../secret' }), /path/);
  await assert.rejects(f.store.readDiff({ ...args, headSha: 'main', path: 'a-129.js' }), /immutable/);
  assert.equal(f.state.transportCalls, transports);
  // Existing installations may have a disk snapshot created before full-manifest support.
  const projectCache = path.dirname(path.dirname(result.local.worktreePath));
  const cacheFile = (await fs.readdir(projectCache)).find(name => name.endsWith('.json'));
  const legacy = { ...result, files: result.files.slice(0, 120) }; delete legacy.manifestVersion;
  await fs.writeFile(path.join(projectCache, cacheFile), JSON.stringify(legacy));
  const rebuilt = await f.create().snapshot({ ...f.request, refs: { base_sha: f.base, head_sha: head } });
  assert.equal(rebuilt.files.length, count); assert.equal(rebuilt.manifestVersion, 2);
});

test('aggregate preview exhaustion defers readable patches rather than labelling them unavailable', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 9; i++) await fs.writeFile(path.join(f.source, `budget-${i}.txt`), (`line ${i} with bounded local review context\n`).repeat(8000));
  git(f.source, 'add', '.'); git(f.source, 'commit', '-m', 'aggregate patch budget');
  const head = git(f.source, 'rev-parse', 'HEAD'); git(f.source, 'update-ref', 'refs/merge-requests/7/head', head);
  const result = await f.store.snapshot({ ...f.request, refs: { base_sha: f.base, head_sha: head } });
  assert.ok(result.files.reduce((sum, file) => sum + Buffer.byteLength(file.diff), 0) <= 2 * 1024 * 1024);
  const deferred = result.files.find(file => file.deferred && file.path.startsWith('budget-'));
  assert.ok(deferred); assert.equal(deferred.unavailable, false);
  const patch = await f.store.readDiff({ projectId: 42, baseSha: f.base, headSha: head, path: deferred.path });
  assert.equal(patch.deferred, false); assert.equal(patch.unavailable, false); assert.match(patch.diff, /bounded local review context/);
});

test('API source index reads immutable regular Git blobs offline, including unchanged connectors', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, 'ContextService.ts'), 'export class ContextService { run() { return 1; } }\n');
  await fs.symlink('/etc/passwd', path.join(f.source, 'LinkedSource.ts'));
  await fs.writeFile(path.join(f.source, 'Binary.ts'), Buffer.from([0, 1, 2]));
  git(f.source, 'add', '.'); git(f.source, 'commit', '-m', 'context'); const base = git(f.source, 'rev-parse', 'HEAD');
  await fs.writeFile(path.join(f.source, 'EntryController.ts'), "import {Controller, Get} from '@nestjs/common'; @Controller('api') export class EntryController { @Get('run') run() { return 1; } }\n");
  git(f.source, 'add', '.'); git(f.source, 'commit', '-m', 'entry'); const head = git(f.source, 'rev-parse', 'HEAD');
  git(f.source, 'update-ref', 'refs/merge-requests/7/head', head);
  await f.store.snapshot({ ...f.request, refs: { base_sha: base, head_sha: head } });
  const calls = f.state.transportCalls; f.state.offline = true;
  const result = await f.store.reviewSources({ projectId: 42, ref: head, baseSha: base });
  assert.equal(result.headSha, head); assert.equal(result.baseSha, base);
  assert.equal(result.files.find(file => file.path === 'ContextService.ts').contextOnly, true);
  assert.equal(result.files.find(file => file.path === 'EntryController.ts').contextOnly, false);
  assert.ok(!result.files.some(file => /LinkedSource|Binary/.test(file.path)));
  assert.ok(result.coverage.omittedFiles >= 1);
  assert.equal(f.state.transportCalls, calls);
  await fs.writeFile(path.join(f.source, 'ContextService.ts'), 'changed working tree');
  assert.match((await f.store.reviewSources({ projectId: 42, ref: head, baseSha: base })).files.find(file => file.path === 'ContextService.ts').content, /return 1/);
  await assert.rejects(f.store.reviewSources({ projectId: 42, ref: 'main', baseSha: base }), /immutable/);
  f.state.config = { ...f.state.config, token: 'ROTATED' };
  await assert.rejects(f.store.reviewSources({ projectId: 42, ref: head, baseSha: base }), /not cached/);
});
