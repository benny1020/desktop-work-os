import React, { useEffect, useState } from "react";
import { BookOpen, GitPullRequest, RefreshCw } from "lucide-react";
import { invoke } from "../lib/integration-client";
import "../context-ux.css";

export default function CrossToolContext({ issueKey, configs, onOpen }) {
  const [groups, setGroups] = useState({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const services = [
      { id: "gitlab", action: "gitlab.mrs", args: { search: issueKey }, map: (data) => (data.items || []).map((mr) => ({
        type: "mr", projectId: mr.project_id, iid: mr.iid, title: `!${mr.iid} ${mr.title}`,
        detail: mr.state || "Merge request", origin: configs.gitlab.url,
      })) },
      { id: "confluence", action: "confluence.search", args: { query: issueKey }, map: (data) => (data.results || []).filter((result) => result.content?.id).map(({ content }) => ({
        type: "doc", id: content.id, title: content.title, detail: "Wiki page", origin: configs.confluence.url,
      })) },
    ].filter(({ id }) => configs?.[id]?.tokenConfigured);
    setGroups(Object.fromEntries(services.map(({ id }) => [id, { loading: true, items: [] }])));
    for (const service of services) {
      invoke(service.action, service.args).then((data) => {
        if (active) setGroups((current) => ({ ...current, [service.id]: { items: service.map(data), loading: false } }));
      }).catch((error) => {
        if (active) setGroups((current) => ({ ...current, [service.id]: { items: [], error: error.message, loading: false } }));
      });
    }
    return () => { active = false; };
  }, [issueKey, configs?.gitlab?.url, configs?.gitlab?.tokenConfigured, configs?.confluence?.url, configs?.confluence?.tokenConfigured, attempt]);
  return (
    <section className="cross-tool-context" aria-label="Related work preview">
      <header><h3>Related work</h3><button className="icon-button" aria-label="Refresh related work" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={12} /></button></header>
      <p>Mentions {issueKey}. These relationships are not verified.</p>
      {Object.entries(groups).map(([service, group]) => {
        const Icon = service === "gitlab" ? GitPullRequest : BookOpen;
        return <div className="cross-tool-group" key={service}>
          <span className="cross-tool-provider"><Icon size={12} />{service === "gitlab" ? "GitLab" : "Confluence"}</span>
          {group.loading && <small role="status">Finding mentions…</small>}
          {group.error && <small role="alert">Could not check {service === "gitlab" ? "GitLab" : "Confluence"}. {group.error}</small>}
          {group.items.slice(0, 2).map((item) => <button className="cross-tool-object" key={item.id || `${item.projectId}:${item.iid}`} onClick={() => onOpen(item)}>
            <b>{item.title}</b><span>{item.detail}</span>
          </button>)}
          {!group.loading && !group.error && !group.items.length && <small>No matching mentions.</small>}
          {group.items.length > 2 && <small>{group.items.length - 2} more in related search</small>}
        </div>;
      })}
      {!Object.keys(groups).length && <p>Connect GitLab or Confluence to find related work.</p>}
      <button className="quiet-button" onClick={() => onOpen({ type: "related", query: issueKey, title: `Related to ${issueKey}` })}>Find linked MR & wiki</button>
    </section>
  );
}
