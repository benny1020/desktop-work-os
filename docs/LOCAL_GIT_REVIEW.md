# Local Git review in Worklane

Reviewed against Git and GitLab primary documentation on **2026-10-04**. The scope is repository code transport and local review; Jira, Wiki and GitLab collaboration metadata still use their existing APIs. This document distinguishes the design contract from checks actually executed below.

## Code comes from Git; collaboration stays with GitLab

| Integration point | Local Git contract | API retained |
|---|---|---|
| MR opening (`getMR`) | Fetch the repository/MR objects, check out the exact head into an app-managed worktree, derive changed files and base-to-head patches locally. Return the existing `files` shape plus checkout provenance. | MR metadata before and after loading; project clone URL; discussions |
| Source viewer (`gitlab.code`) | Read the requested immutable commit/path from the app-managed object database. Never read through checkout symlinks into the host filesystem. | None for file contents |
| Diagram and Claude guide | Analyze the same local snapshot the reviewer sees. Keep path, line, coverage and all three diff references attached to the result. | Explicit Claude generation only; fresh MR metadata |
| Comment | Validate expected base/start/head, file membership and valid diff line before posting. Preserve drafts on mismatch or failed writes. | GitLab discussions POST |
| Approve | Validate the reviewed references and send the reviewed head in GitLab's `sha` field. | GitLab approval POST |
| Pipeline/context preview | Preserve current review selection, guide and draft when navigating out and back. | Pipeline metadata/jobs and linked business objects |

There is **no fallback to GitLab `/diffs`, raw diffs, repository-file raw APIs or compare APIs** when Git fails. Failures need an honest retry state: unavailable Git, access denied, missing revision, stale MR, or local preview limit. A fallback would both violate the selected transport and hide a broken checkout.

Existing renderer contracts should remain stable: `ConnectedObjects` and `ConnectedWorkspace` request `gitlab.mr`; `ReviewWorkbench` consumes a snapshot and requests `gitlab.code`. The name of an IPC action does not imply HTTP. Navigation caches and restored review state must be keyed by host/account, project, MR and the complete diff reference tuple. Source caches require immutable commit plus path. Display the source branch as context, but never use its moving name as the identity of a displayed review.

## Why immutable MR references matter

GitLab documents `refs/merge-requests/:iid/head` as a local checkout entry point, including merge requests from private forks. It also documents removal of that ref 14 days after a merge request closes or merges. A source-branch name in the target repository is therefore not a reliable substitute for the MR head ref. An unavailable historical ref should produce a recoverable error or an explicitly validated exact-object fetch, not silently select another branch. [GitLab: local MR checkout](https://docs.gitlab.com/user/project/merge_requests/merge_request_troubleshooting/#check-out-merge-requests-locally-through-the-head-ref)

MR metadata provides separate base/head/start references and source/target project identities. Worklane uses the API-provided base-to-head range for local patches and preserves `start_sha` for the review's identity; it must not replace the base with today's target branch tip. Read metadata again after local preparation and reject a changed tuple. [GitLab: merge requests API](https://docs.gitlab.com/api/merge_requests/)

GitLab inline discussions carry base, head and start SHA plus both paths and applicable old/new line numbers. Approval has a server-side head precondition: a mismatching `sha` returns HTTP 409. Worklane should retain those controls even after removing code HTTP endpoints. Metadata preflight cannot make every subsequent network write atomic; an ambiguous write result must preserve the draft and avoid automatic retries that could post twice. [Discussions API](https://docs.gitlab.com/api/discussions/#create-a-merge-request-thread), [Approvals API](https://docs.gitlab.com/api/merge_request_approvals/#approve-merge-request)

## Local repository and checkout rules

Git clone establishes a local repository and remote-tracking references. Linked worktrees share repository objects while providing separate checkouts; `worktree add --detach` checks out a particular commit without moving a user's branch. Worklane's app-managed bare repository plus explicit fetch and detached worktree is the same object/checkout separation, rather than a second developer checkout that it might reset unexpectedly. [Git clone](https://git-scm.com/docs/git-clone), [Git worktree](https://git-scm.com/docs/git-worktree)

Application requirements:

- Derive storage directories from validated account scope and numeric project IDs. Never accept a renderer-supplied host filesystem path as the repository root.
- Allow only the configured HTTPS GitLab origin and installation path for production clone URLs. Keep fork access on validated target/MR refs; never send a token to an arbitrary source URL from content.
- Serialize repository mutations per account/project. Re-check credentials after asynchronous work; a delayed operation for an old account cannot return current-account code.
- Validate full immutable SHAs. Require object existence/type before treating cached metadata as a usable snapshot.
- Use subprocess argument arrays with no shell. Treat repository filenames literally, including glob and Git pathspec characters. Renames must not pull another changed file into a single file's patch or confuse old/new paths.
- Use Git blobs for source reading, even if someone edits the checkout on disk. Cap output and execution time; show binary/large/unavailable files honestly and mark incomplete diff coverage.
- Do not initialize submodules, execute project scripts, install dependencies, run hooks, or push branches merely to review code. Do not use a developer's existing checkout as disposable cache.

Git supports external diff/text conversion drivers. Disable them explicitly for generated diffs; otherwise review operations can execute configured tools or transform content into something that is not the original blob. [Git show: external diff and text conversion](https://git-scm.com/docs/git-show)

## Credentials and subprocess isolation

GitLab supports token-based HTTPS repository access, with repository-read permission for clone/pull; the existing integration may need broader permission for comments and approval. Do not assume a successful API connection proves Git-over-HTTPS access. [GitLab clone authentication](https://docs.gitlab.com/topics/git/clone/), [GitLab token scopes](https://docs.gitlab.com/security/tokens/access_token_scopes/)

Git's askpass mechanism can supply credentials on demand. Worklane should use an app-owned helper containing **no token**, supply the token only to the fetch subprocess, suppress terminal prompts, and leave the remote URL token-free. Do not copy token-in-URL documentation examples into the application: URL credentials can persist in config, command arguments and errors. Credential data must never appear in renderer provenance or test evidence. [Git credentials](https://git-scm.com/docs/gitcredentials)

Git can inherit system/global configuration and configured hooks. Use a controlled configuration environment, disable credential helpers and hooks, and remove inherited `GIT_*`/`SSH_*` command overrides before running app-managed Git. These are application security requirements informed by Git's configuration mechanisms, not claims that Git sandboxes repositories. [Git configuration](https://git-scm.com/docs/git-config)

## Verification

### Native fixture approach

`scripts/test-connected-desktop.mjs` uses `scripts/fixtures/local-git-review.mjs` to create actual temporary base/head commits and an MR head ref. A **temporary test bootstrap** wraps the module constructor's dependency-injection seam to route one fixed fixture clone URL to that repository, then loads the real Electron main process. There is no production environment-variable backdoor and no replacement of the Git executable or code parser.

The native test exercises UI → preload → main → actual Git subprocesses. GitLab metadata/discussion/approval/Claude requests use isolated HTTPS fixtures. It rejects code HTTP routes and asserts:

- A local-checkout indicator is visible.
- The source read matches the committed fixture blob exactly.
- Local snapshot and file-read operations actually ran.
- No GitLab diff or raw-file HTTP request occurred.
- The existing issue → wiki → MR diagram → source/comment → guide/approval → pipeline workflow still works.

A successful fixture test does not verify an enterprise GitLab certificate/proxy, SSO/token policy, fork permission, very large repository or real external comment/approval. Those require the corresponding company environment. Test run results and any remaining implementation findings are recorded below once execution completes.

### Executed checks (2026-10-04)

- `npm run build`: passed.
- `node scripts/test-connected-desktop.mjs`: **8/8 workflow checks**, 36 fixture HTTPS requests, **zero diff/raw-code API requests**, three real local snapshot operations, two real blob reads, zero renderer errors. Evidence: `research/completion/electron-workflows.json` (generated local artifact).
- `node --test tests/integration/local-git.test.mjs`: **11/11 passed**, covering immutable checkout, restart/offline store access, multiple versions, concurrent requests, transport/path rejection, credential rotation and no persisted token, binary/oversized previews, literal filenames, stale-account rejection, offline reconstruction of a deleted checkout, and bounded transport timeout with descendant-process cleanup and successful retry.
- Separate independent Git fixture: a poisoned inherited global config defining a checkout hook, smudge filter and textconv driver did not execute; renaming a file while adding new content at its old path produced no mixed per-file patches; source matched the exact committed blob.

The first native run caught a test locator error: the provenance label sits outside the code-scroll body. Correcting the locator to the visible provenance label allowed the complete workflow to pass; no product change was required for that failure.

Local source objects, worktrees and diff cache files are ordinary on-disk repository data under the app-managed profile directory, **not the encrypted assistant-memory store**. Access is scoped to configured GitLab credentials, and new credentials use a separate cache namespace. Preview limits bound displayed/diff output, not total cloned repository disk use. There is no total cache quota or automatic pruning in this iteration. Store-level cached source reads were tested without transport access; opening an MR still requests fresh GitLab metadata and is not a full offline product mode.
