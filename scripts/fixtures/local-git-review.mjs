import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

/** Native test seam only: real Git objects, no production transport override. */
export async function prepareLocalReviewFixture({ root, directory, snapshot }) {
  const repository = path.join(directory, 'fixture-repository');
  await fs.mkdir(repository, { recursive: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' });
  const git = async (...args) => (await execute('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Worklane Fixture', '-c', 'user.email=fixture@example.test', ...args], { cwd: repository, env })).stdout.trim();
  await git('init', '-b', 'main');
  await fs.writeFile(path.join(repository, 'README.md'), 'Isolated native review fixture.\n');
  for (const file of snapshot.contextFiles || []) {
    const target = path.join(repository, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }
  await git('add', '--', '.');
  await git('commit', '-m', 'Base fixture');
  const base = await git('rev-parse', 'HEAD');
  await git('checkout', '-b', snapshot.mr.source_branch);
  for (const file of snapshot.files) {
    const target = path.join(repository, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }
  await git('add', '--', 'src');
  await git('commit', '-m', 'Review fixture sources');
  const head = await git('rev-parse', 'HEAD');
  await git('update-ref', `refs/merge-requests/${snapshot.mr.iid}/head`, head);
  const updated = structuredClone(snapshot);
  updated.mr.diff_refs = { base_sha: base, start_sha: base, head_sha: head };
  updated.mr.sha = head;
  updated.mr.source_project_id = updated.mr.project_id;
  updated.mr.target_project_id = updated.mr.project_id;
  const cloneUrl = 'https://gitlab.fixture.test/platform/payment-api.git';
  const bootstrap = path.join(directory, 'native-local-review.cjs');
  await fs.writeFile(bootstrap, `
const mod = require(${JSON.stringify(path.join(root, 'electron/local-git.cjs'))});
const original = mod.createLocalGitStore;
global.__localGitCalls = [];
mod.createLocalGitStore = (options) => {
  const store = original({ ...options, trustedTransport: (url) => {
    if (url !== ${JSON.stringify(cloneUrl)}) throw Error('Unexpected native fixture clone URL');
    return ${JSON.stringify(pathToFileURL(repository).href)};
  }});
  return Object.fromEntries(Object.entries(store).map(([name, fn]) => [name, async (...args) => {
    const result = await fn(...args);
    global.__localGitCalls.push({ name, args, local: result.local, ref: result.ref, path: result.path });
    return result;
  }]));
};
require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});
`);
  return { snapshot: updated, bootstrap, cloneUrl, repository, head, base };
}
