import React, { useRef, useState } from "react";
import "../context-ux.css";

export default function PipelineSummary({ pipeline }) {
  const jobs = pipeline.jobs || [];
  const failures = jobs.filter((job) => job.status === "failed");
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [selected, setSelected] = useState(null);
  const body = useRef(null);
  const visible = onlyFailures ? failures : jobs;
  const complete = jobs.filter((job) => ["success", "failed", "canceled", "skipped"].includes(job.status)).length;
  function inspect(job) {
    setOnlyFailures(false); setSelected(job.id);
    requestAnimationFrame(() => {
      const target = [...(body.current?.querySelectorAll("[data-pipeline-job]") || [])].find((node) => node.dataset.pipelineJob === String(job.id));
      target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "nearest" });
    });
  }
  return <section className="pipeline-summary" ref={body} aria-label="Pipeline execution summary">
    <div className="pipeline-evidence"><b>{complete} / {jobs.length} jobs finished</b><span>{failures.length ? `${failures.length} failed` : "No failed jobs in these results"}</span></div>
    {failures.length > 0 && <div className="pipeline-failure-path"><strong>Investigate failures</strong>{failures.map((job) => <button className="linked-chip" key={job.id} onClick={() => inspect(job)}>{job.stage} / {job.name}</button>)}</div>}
    <div className="pipeline-job-filter" role="group" aria-label="Filter pipeline jobs">
      <button className={!onlyFailures ? "active" : ""} aria-pressed={!onlyFailures} onClick={() => setOnlyFailures(false)}>All jobs ({jobs.length})</button>
      <button className={onlyFailures ? "active" : ""} aria-pressed={onlyFailures} disabled={!failures.length} onClick={() => setOnlyFailures(true)}>Failed jobs ({failures.length})</button>
    </div>
    <div className="pipeline-stages">{[...new Set(visible.map((job) => job.stage))].map((stage) => <section key={stage}>
      <h3>{stage}<small>{visible.filter((job) => job.stage === stage).length} jobs</small></h3>
      {visible.filter((job) => job.stage === stage).map((job) => <div className={`pipeline-job ${selected === job.id ? "selected" : ""}`} key={job.id} data-pipeline-job={job.id} tabIndex={-1}>
        <b>{job.name}</b><span className={`pill ${job.status === "failed" ? "failed" : ""}`}>{job.status}</span><small>{job.duration == null ? "—" : `${job.duration}s`}</small>
      </div>)}
    </section>)}</div>
    {!jobs.length && <p>No jobs were returned for this pipeline.</p>}
    {pipeline.truncated && <p className="form-note">First 300 jobs shown. Counts and failure filters cover these results only.</p>}
  </section>;
}
