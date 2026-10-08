import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { invoke } from "../lib/integration-client";
import { nextAgilePage } from "../lib/jira-workspace.mjs";

export default function JiraProjectPicker({ origin, configVersion, value, onChange, onProjects, sprintView }) {
  const [projects, setProjects] = useState([]), [results, setResults] = useState([]),
    [opened, setOpened] = useState(false), [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""),
    [more, setMore] = useState(null), [appliedQuery, setAppliedQuery] = useState("");
  const request = useRef(0), lookup = useRef(null), known = useRef([]), lastAttempt = useRef({ query: "", startAt: 0 });
  const onProjectsRef = useRef(onProjects); onProjectsRef.current = onProjects;
  useEffect(() => {
    known.current = []; setProjects([]); setResults([]); setQuery(""); setMore(null); setAppliedQuery("");
    read("", 0);
    return () => { request.current++; };
  }, [origin, configVersion]);
  async function read(search, startAt = 0) {
    const ticket = ++request.current;
    lastAttempt.current = { query: search, startAt };
    setBusy(true); setError("");
    try {
      const result = await invoke("jira.projects", { query: search, startAt });
      if (ticket !== request.current) return;
      const values = result.values || [];
      known.current = [...new Map([...known.current, ...values].map(project => [project.key, project])).values()];
      setProjects(known.current);
      setResults(previous => startAt ? [...new Map([...previous, ...values].map(project => [project.key, project])).values()] : values);
      setMore(nextAgilePage(result)); setAppliedQuery(search);
      if (!search) onProjectsRef.current(known.current);
    } catch (e) { if (ticket === request.current) setError(e.message); }
    finally { if (ticket === request.current) setBusy(false); }
  }
  function choose(key) {
    onChange(key);
    lookup.current.open = false;
    lookup.current.querySelector("summary")?.focus();
  }
  return <>
    <label>Project <select aria-label="Jira project filter" value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{sprintView ? "Choose project" : "All projects"}</option>
      {value && !projects.some(project => project.key === value) && <option value={value}>{value}</option>}
      {projects.map(project => <option key={project.key} value={project.key}>{project.key} · {project.name}</option>)}
    </select></label>
    <details className="jira-project-lookup" ref={lookup} onKeyDown={event => {
      if (event.key === "Escape") { event.stopPropagation(); lookup.current.open = false; lookup.current.querySelector("summary")?.focus(); }
    }} onToggle={event => { setOpened(event.currentTarget.open); if (event.currentTarget.open) event.currentTarget.querySelector("input")?.focus(); }}>
      <summary>Find project</summary>
      <div className="jira-project-options">
        <form className="jira-quick-search" onSubmit={event => { event.preventDefault(); read(query.trim()); }}>
          <Search size={14} /><input aria-label="Search Jira projects" placeholder="Project name or key…" value={query} onChange={event => setQuery(event.target.value)} />
          <button className="btn" disabled={busy}>Find</button>
        </form>
        <small>{busy ? "Finding projects…" : `${results.length} projects shown${more !== null ? " · More available" : ""}`}</small>
        {error && <div role="alert">Project search unavailable. {error}<button className="btn" disabled={busy} onClick={() => read(lastAttempt.current.query, lastAttempt.current.startAt)}>Retry project search</button></div>}
        <div className="jira-project-results">
          {results.map(project => <button className="quiet-button" key={project.key} onClick={() => choose(project.key)}><b>{project.key}</b><span>{project.name}</span></button>)}
          {!results.length && !busy && !error && <p>No accessible projects found. Try another name or key.</p>}
        </div>
        {more !== null && <button className="btn" disabled={busy} onClick={() => read(appliedQuery, more)}>Load more projects</button>}
      </div>
    </details>
    {error && !opened && <button className="quiet-button jira-filter-warning" disabled={busy} onClick={() => { lookup.current.open = true; }}>Project list unavailable · Retry</button>}
  </>;
}
