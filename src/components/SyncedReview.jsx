import React, { useEffect, useRef, useState } from "react";
import ReviewWorkbench from "./ReviewWorkbench";
import SyncStatus from "./SyncStatus";
import { useAutoSync } from "../lib/use-auto-sync";
import { invoke } from "../lib/integration-client";

const revision = data => JSON.stringify([data.mr.diff_refs.base_sha, data.mr.diff_refs.start_sha, data.mr.diff_refs.head_sha]);
// Prepare new Git objects automatically, but never move the code beneath a reviewer.
export default function SyncedReview({ snapshot, onPendingChange, refreshing, onSynchronized, ...props }) {
  const [active, setActive] = useState(snapshot);
  const [incoming, setIncoming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mutation, setMutation] = useState("");
  const activeRef = useRef(active); activeRef.current = active;
  const incomingRef = useRef(incoming); incomingRef.current = incoming;
  useEffect(() => { setActive(snapshot); setIncoming(null); }, [snapshot]);
  const sync = useAutoSync({
    key: `review:${snapshot.mr.web_url}:${snapshot.mr.project_id}:${snapshot.mr.iid}`,
    services: ["gitlab"], enabled: !busy && !mutation && !refreshing,
    refresh: async isCurrent => {
      const args = { projectId: activeRef.current.mr.project_id, iid: activeRef.current.mr.iid };
      const update = await invoke("gitlab.mrUpdates", args);
      if (!isCurrent()) return;
      if (revision(update) === revision(activeRef.current)) {
        setIncoming(null);
        setActive(old => ({ ...old, ...update }));
        onSynchronized?.();
      } else {
        if (incomingRef.current?.snapshot && revision(incomingRef.current.snapshot) === revision(update)) {
          setIncoming(old => ({ snapshot: { ...old.snapshot, ...update } }));
          onSynchronized?.();
          return;
        }
        setIncoming(old => old?.snapshot && revision(old.snapshot) === revision(update) ? old : { preparing: true });
        const next = await invoke("gitlab.mr", args);
        if (!isCurrent()) return;
        if (revision(next) === revision(activeRef.current)) { setIncoming(null); setActive(next); }
        else setIncoming({ snapshot: next });
        onSynchronized?.();
      }
    },
  });
  useEffect(() => { sync.markSynced(); }, [snapshot]);
  return <>
    {incoming && <div className="review-revision-banner">
      <div className="review-revision-notice">
        <span><strong>{incoming.snapshot ? "New revision ready" : "New revision detected · preparing local checkout"}</strong>
          <small>Your current code and draft stay on this revision. Earlier drafts remain saved with their commit.</small>
        </span>
        <button className="btn primary" disabled={!incoming.snapshot || busy || !!mutation || refreshing} onClick={() => {
          setActive(incoming.snapshot); setIncoming(null);
        }}>Review new revision</button>
      </div>
    </div>}
    <ReviewWorkbench {...props} live snapshot={active}
      key={active.mr.diff_refs.head_sha} refreshing={refreshing} revisionPending={!!incoming}
      syncStatus={<span className="review-auto-sync"><SyncStatus sync={sync} /></span>}
      onBusyChange={setBusy}
      onPendingChange={value => { setMutation(value); onPendingChange?.(value); }} />
  </>;
}
