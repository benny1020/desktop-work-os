export const isDesktop = () => !!window.orbit?.invoke;
const inFlight = new Map();
let configurationEpoch = 0;
const writes = new Set(["jira.edit", "jira.comment", "jira.transition", "jira.moveSprint", "jira.create", "gitlab.comment", "gitlab.approve", "confluence.create"]);
const reads = /^(config\.list|jira\.(issues|issue|transitions|assignees|editMetadata|boards|sprints|projects|createMetadata)|gitlab\.(mrs|mr|mrUpdates|diff|code|projects|pipelines|pipeline|mrPipelines)|confluence\.(pages|page|spaces|search))$/;
export async function invoke(action, args = {}) {
  if (!isDesktop())
    throw new Error("실제 서비스 연결은 Electron 앱에서 사용할 수 있습니다. 브라우저에서는 데모를 확인하세요.");
  const epoch = configurationEpoch;
  const key = `${epoch}:${action}:${JSON.stringify(args)}`;
  if (reads.test(action) && inFlight.has(key)) return inFlight.get(key);
  const task = (async () => {
    const result = await window.orbit.invoke(action, args);
    if (reads.test(action) && epoch !== configurationEpoch) throw Error("Integration configuration changed. Reopen this view.");
    if (writes.has(action) || ["config.save", "config.remove"].includes(action)) {
      const configChanged = action.startsWith("config.");
      if (configChanged) configurationEpoch++;
      const service = configChanged ? args.service : action.split(".")[0];
      for (const cached of inFlight.keys()) if (configChanged || cached.includes(`:${service}.`)) inFlight.delete(cached);
      window.dispatchEvent(new CustomEvent("worklane:integration-changed", { detail: { service, configChanged } }));
    }
    return result;
  })();
  if (reads.test(action)) {
    inFlight.set(key, task);
    try { return await task; } finally { if (inFlight.get(key) === task) inFlight.delete(key); }
  }
  return task;
}
