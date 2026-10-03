import React from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import "../sync.css";
export default function SyncStatus({ sync }) {
  const label = sync.offline ? "Offline · keeping last data" : sync.error ? "Sync delayed · retrying automatically" : sync.syncing ? "Syncing…" : "Auto-sync on";
  const Icon = sync.offline || sync.error ? CloudOff : sync.syncing ? RefreshCw : Cloud;
  const detail = sync.error || (sync.lastSynced ? `Last checked ${new Date(sync.lastSynced).toLocaleTimeString()}. Checks every minute and when you return.` : "Checks every minute and when you return. Your drafts stay intact.");
  return <span className={`sync-status ${sync.error || sync.offline ? "delayed" : ""}`} aria-label={`Automatic synchronization: ${label}`} title={detail}>
    <Icon size={12} className={sync.syncing && !sync.offline ? "spin" : ""} />{label}
  </span>;
}
