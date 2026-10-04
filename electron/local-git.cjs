const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i;
const MAX_FILES = 120;
const MAX_DIFF = 2 * 1024 * 1024;
const MAX_FILE = 512 * 1024;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function validSha(value) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error('An immutable Git commit is required. Refresh the merge request.');
  return value.toLowerCase();
}
function validPath(value) {
  if (typeof value !== 'string' || !value || value.length > 4096 || value.includes('\0') || value.includes('\\') || path.posix.isAbsolute(value) || value.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid repository file path.');
  return value;
}
function createLocalGitStore({ directory, getConfig, trustedTransport, trustedGitExecutable, commandTimeoutMs = 120000 }) {
  const locks = new Map();
  async function context(projectId) {
    if (!/^\d{1,20}$/.test(String(projectId))) throw new Error('A numeric GitLab project ID is required.');
    const config = await getConfig();
    if (!config?.url || !config?.token) throw new Error('Connect GitLab before opening local source.');
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('A valid GitLab HTTPS URL is required.');
    const scope = hash(config.url + '\0' + config.token);
    const root = path.join(directory, scope, String(projectId));
    return { config, scope, root, repo: path.join(root, 'repository.git') };
  }
  async function assertCurrent(c) {
    const config = await getConfig();
    if (hash((config?.url || '') + '\0' + (config?.token || '')) !== c.scope) throw new Error('GitLab account changed. Reopen the merge request.');
  }
  async function locked(c, operation) {
    const previous = locks.get(c.root) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    locks.set(c.root, next);
    try { return await next; } finally { if (locks.get(c.root) === next) locks.delete(c.root); }
  }
  function run(c, args, { max = MAX_DIFF, transport = false } = {}) {
    return new Promise((resolve, reject) => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|SSH_|WORKLANE_GIT_)/.test(key)));
      Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_SYSTEM: os.devNull, GIT_TERMINAL_PROMPT: '0', GIT_ATTR_NOSYSTEM: '1', GIT_LFS_SKIP_SMUDGE: '1', LC_ALL: 'C' });
      if (transport) Object.assign(env, { GIT_ASKPASS: path.join(directory, 'askpass.sh'), WORKLANE_GIT_TOKEN: c.config.token });
      const options = ['--literal-pathspecs', '-c', 'credential.helper=', '-c', 'core.hooksPath=' + path.join(directory, 'no-hooks'), '-c', 'core.fsmonitor=false', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', '-c', 'http.followRedirects=false', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'diff.external=', '-c', 'core.attributesFile=' + os.devNull];
      if (trustedTransport) options.push('-c', 'protocol.file.allow=always');
      const grouped = process.platform !== 'win32';
      const child = spawn(trustedGitExecutable || 'git', [...options, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: grouped });
      const chunks = []; let bytes = 0; let exceeded = false; let completed = false; let terminationTimer;
      const limitError = () => Object.assign(new Error('Local source exceeds the preview limit or Git timed out.'), { code: 'GIT_LIMIT' });
      function finish(error, value) {
        if (completed) return;
        completed = true; clearTimeout(timer); clearTimeout(terminationTimer);
        if (error) reject(error); else resolve(value);
      }
      function terminate() {
        if (exceeded || completed) return;
        exceeded = true;
        // Killing only Git leaves remote helpers/index-pack alive with open pipes and locks.
        // Each POSIX invocation owns its process group, so terminate the entire operation.
        if (grouped && child.pid) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        } else {
          if (child.pid) {
            const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            killer.on('error', () => {}); killer.unref();
          }
          child.kill('SIGKILL');
        }
        // Even an OS/helper failure cannot retain the repository mutex indefinitely.
        terminationTimer = setTimeout(() => {
          child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish(limitError());
        }, 1000);
      }
      const timer = setTimeout(terminate, Math.max(50, Math.min(120000, commandTimeoutMs)));
      child.stdout.on('data', chunk => { if (completed || exceeded) return; bytes += chunk.length; if (bytes > max) terminate(); else chunks.push(chunk); });
      child.stderr.on('data', () => {}); // Never expose remote output: it can contain credentials or untrusted escape sequences.
      child.on('error', () => finish(new Error('Git is unavailable. Install Git and retry.')));
      child.on('close', code => {
        if (exceeded) finish(limitError());
        else if (code) finish(new Error('Git could not load this revision. Check repository access and refresh.'));
        else finish(null, Buffer.concat(chunks));
      });
    });
  }
  async function exists(c, ref) {
    try { await run(c, ['--git-dir', c.repo, 'cat-file', '-e', ref + '^{commit}'], { max: 100 }); return true; } catch (error) { if (error.code === 'GIT_LIMIT') throw error; return false; }
  }
  async function setup(c, repoUrl) {
    const base = new URL(c.config.url); let url;
    try { url = new URL(repoUrl); } catch { throw new Error('A GitLab HTTPS clone URL is required.'); }
    const prefix = base.pathname.replace(/\/$/, '');
    if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('.git') || (prefix && !url.pathname.startsWith(prefix + '/'))) throw new Error('Clone URL must belong to the configured GitLab instance.');
    await fs.mkdir(c.root, { recursive: true, mode: 0o700 });
    // This helper contains no token. The secret is supplied only in the child process environment.
    const helper = '#!/bin/sh\ncase "$1" in *sername*) printf "%s\\n" oauth2 ;; *) printf "%s\\n" "$WORKLANE_GIT_TOKEN" ;; esac\n';
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const helperTemporary = path.join(directory, 'askpass.' + crypto.randomUUID() + '.tmp');
    await fs.writeFile(helperTemporary, helper, { mode: 0o700 });
    await fs.rename(helperTemporary, path.join(directory, 'askpass.sh'));
    try { await fs.access(path.join(c.repo, 'HEAD')); } catch { await run(c, ['init', '--bare', c.repo]); }
    return trustedTransport ? await trustedTransport(url.href) : url.href;
  }
  async function ensureCheckout(c, head) {
    const worktree = path.join(c.root, 'checkouts', head);
    try { await fs.access(path.join(worktree, '.git')); }
    catch {
      await fs.mkdir(path.dirname(worktree), { recursive: true, mode: 0o700 });
      // This clears registration metadata for externally deleted paths only; no checkout is deleted.
      await run(c, ['--git-dir', c.repo, 'worktree', 'prune', '--expire=now']);
      await run(c, ['--git-dir', c.repo, 'worktree', 'add', '--detach', worktree, head]);
    }
    const actual = (await run(c, ['-C', worktree, 'rev-parse', '--verify', 'HEAD'], { max: 100 })).toString('utf8').trim();
    if (actual !== head) throw new Error('The managed checkout was changed outside Worklane. Restore its original revision before reopening.');
    return worktree;
  }
  async function changedFiles(c, base, head) {
    const tokens = (await run(c, ['--git-dir', c.repo, 'diff', '--raw', '--no-abbrev', '-z', '-M', base, head, '--'], { max: 2 * 1024 * 1024 })).toString('utf8').split('\0');
    const changes = [];
    for (let i = 0; i < tokens.length && tokens[i];) {
      const [oldMode, newMode, oldObject, newObject, status] = tokens[i++].slice(1).split(' ');
      const oldPath = tokens[i++]; const newPath = /^[RC]/.test(status) ? tokens[i++] : oldPath;
      if (!status || !oldPath || !newPath || !SHA.test(oldObject) || !SHA.test(newObject)) throw new Error('Git returned an incomplete changed-file manifest.');
      changes.push({ status, oldPath, newPath, oldMode, newMode, oldObject, newObject });
    }
    return changes;
  }
  function fileMetadata(change) {
    return { old_path: change.oldPath, new_path: change.newPath, path: change.newPath,
      new_file: change.status[0] === 'A', deleted_file: change.status[0] === 'D', renamed_file: change.status[0] === 'R', diff: '' };
  }
  async function emptyBlob(c) {
    return (await run(c, ['--git-dir', c.repo, 'hash-object', '-w', '--stdin'], { max: 100 })).toString('utf8').trim();
  }
  async function filePatch(c, change, empty) {
    const file = { ...fileMetadata(change), deferred: false, unavailable: false, binary: false };
    try {
      validPath(change.oldPath); validPath(change.newPath);
      if ([change.oldMode, change.newMode].includes('160000')) return { ...file, unavailable: true, unavailableReason: 'Submodule revisions cannot be displayed as a file patch.' };
      const oldObject = /^0+$/.test(change.oldObject) ? empty : change.oldObject;
      const newObject = /^0+$/.test(change.newObject) ? empty : change.newObject;
      // Compare exact blob IDs from the Git manifest, never a pathspec spanning multiple files.
      file.diff = (await run(c, ['--git-dir', c.repo, 'diff', '--no-ext-diff', '--no-textconv', '--no-color', '--src-prefix=a/', '--dst-prefix=b/', oldObject, newObject, '--'], { max: MAX_FILE })).toString('utf8');
      file.binary = /^Binary files /m.test(file.diff);
      if (file.binary) file.unavailableReason = 'Binary files cannot be displayed as text patches.';
    } catch (error) {
      file.unavailable = true; file.diff = '';
      file.unavailableReason = error.code === 'GIT_LIMIT' ? 'This patch exceeds the 512 KiB preview limit or Git timed out.' : 'This file patch could not be read from the local revision.';
    }
    return file;
  }
  async function snapshot({ projectId, iid, repoUrl, refs = {}, sourceBranch = '', refresh = false }) {
    const c = await context(projectId);
    const head = validSha(refs.head_sha); const base = validSha(refs.base_sha || refs.start_sha);
    if (!/^\d{1,20}$/.test(String(iid))) throw new Error('A numeric merge request ID is required.');
    const branch = String(sourceBranch).slice(0, 300).replace(/[\x00-\x1f\x7f]/g, '');
    return locked(c, async () => {
      await assertCurrent(c);
      const transportUrl = await setup(c, repoUrl);
      const cachePath = path.join(c.root, hash(base + ':' + head) + '.json');
      if (!refresh && await exists(c, head) && await exists(c, base)) {
        let cached;
        try { cached = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch { /* Rebuild missing/corrupt derived metadata. */ }
        if (cached?.manifestVersion === 2) {
          const worktreePath = await ensureCheckout(c, head);
          await assertCurrent(c);
          return { ...cached, local: { ...cached.local, sourceBranch: branch, worktreePath, cacheHit: true } };
        }
      }
      // Exact immutable commits keep an MR review stable while its source branch moves.
      // MR head ref also supports fork MRs whose source branch is not in the target project.
      if (refresh || !await exists(c, head)) {
        try { await run(c, ['--git-dir', c.repo, 'fetch', '--no-tags', '--no-recurse-submodules', transportUrl, 'refs/merge-requests/' + iid + '/head'], { transport: true }); }
        catch (error) {
          if (error.code === 'GIT_LIMIT') throw error;
          /* Some instances hide MR refs; exact SHA fetch is the fallback. */
        }
        if (!await exists(c, head)) await run(c, ['--git-dir', c.repo, 'fetch', '--no-tags', '--no-recurse-submodules', transportUrl, head], { transport: true });
      }
      if (!await exists(c, base)) await run(c, ['--git-dir', c.repo, 'fetch', '--no-tags', '--no-recurse-submodules', transportUrl, base], { transport: true });
      await assertCurrent(c);
      const worktree = await ensureCheckout(c, head);
      const changes = await changedFiles(c, base, head);
      const empty = await emptyBlob(c);
      let remaining = MAX_DIFF; let truncated = false; const files = [];
      for (let index = 0; index < changes.length; index++) {
        const change = changes[index];
        if (index >= MAX_FILES || remaining < 1024) {
          files.push({ ...fileMetadata(change), deferred: true, unavailable: false });
          truncated = true;
          continue;
        }
        const file = await filePatch(c, change, empty);
        const bytes = Buffer.byteLength(file.diff);
        if (bytes > remaining) {
          files.push({ ...fileMetadata(change), deferred: true, unavailable: false });
          truncated = true;
          continue;
        }
        remaining -= bytes;
        if (file.unavailable) truncated = true;
        files.push(file);
      }
      await assertCurrent(c);
      const result = { manifestVersion: 2, files, truncated, local: { status: 'ready', source: 'local-git', mode: 'local-git', headSha: head, baseSha: base, sourceBranch: branch, syncedAt: new Date().toISOString(), worktreePath: worktree, cacheHit: false, fileCount: changes.length } };
      const temporary = cachePath + '.' + crypto.randomUUID() + '.tmp';
      await fs.writeFile(temporary, JSON.stringify(result), { mode: 0o600 }); await fs.rename(temporary, cachePath);
      return result;
    });
  }
  async function readDiff({ projectId, baseSha, headSha, path: filename }) {
    const c = await context(projectId); const base = validSha(baseSha); const head = validSha(headSha); const safePath = validPath(filename);
    return locked(c, async () => {
      await assertCurrent(c);
      if (!await exists(c, base) || !await exists(c, head)) throw new Error('This revision is not cached. Open or refresh the merge request first.');
      const changes = await changedFiles(c, base, head);
      const change = changes.find(value => value.newPath === safePath);
      if (!change) throw new Error('The selected file is not in this revision diff.');
      const result = await filePatch(c, change, await emptyBlob(c));
      await assertCurrent(c);
      return { ...result, local: true, baseSha: base, headSha: head };
    });
  }
  async function readFile({ projectId, ref, path: filename }) {
    const c = await context(projectId); const sha = validSha(ref); const safePath = validPath(filename);
    return locked(c, async () => {
      await assertCurrent(c);
      if (!await exists(c, sha)) throw new Error('This revision is not cached. Open or refresh the merge request first.');
      const object = sha + ':' + safePath;
      const type = (await run(c, ['--git-dir', c.repo, 'cat-file', '-t', object], { max: 100 })).toString('utf8').trim();
      if (type !== 'blob') throw new Error('Only repository files can be previewed.');
      const content = await run(c, ['--git-dir', c.repo, 'show', object], { max: MAX_FILE });
      if (content.includes(0)) throw new Error('Binary files cannot be shown as code.');
      await assertCurrent(c);
      return { content: content.toString('utf8'), ref: sha, path: safePath, local: true };
    });
  }
  return { snapshot, readFile, readDiff };
}
module.exports = { createLocalGitStore };
