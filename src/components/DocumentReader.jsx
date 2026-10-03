import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import "../context-ux.css";

export default function DocumentReader({ html, onOpen, jiraOrigin, jiraConfigured }) {
  const body = useRef(null);
  const [activeHeading, setActiveHeading] = useState(-1);
  useEffect(() => { setActiveHeading(-1); }, [html]);
  const content = useMemo(() => {
    const clean = DOMPurify.sanitize(html || "", {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["img", "iframe", "form", "input", "style", "video", "audio", "source", "link"],
      FORBID_ATTR: ["style", "src", "srcset", "href", "action"],
    });
    const document = new DOMParser().parseFromString(clean, "text/html");
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((heading) => ({ title: heading.textContent, level: Number(heading.tagName.slice(1)) }));
    // textContent joins adjacent block elements without a separator. Preserve
    // their visible boundaries so a heading cannot swallow the next issue key.
    const text = [...[...document.querySelectorAll("p,div,li,pre,td,th,h1,h2,h3,h4,h5,h6")].map((node) => node.textContent), document.body.textContent || ""].join("\n");
    const issues = [...new Set(text.match(/\b[A-Z][A-Z0-9_]+-\d+\b/g) || [])];
    return { clean, headings, issues };
  }, [html]);
  function jump(index) {
    const heading = body.current?.querySelectorAll("h1,h2,h3,h4,h5,h6")[index];
    if (!heading) return;
    setActiveHeading(index);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return <div className="document-reader">
    {content.issues.length > 0 && <div className="document-issue-refs">
      <span>Issue keys in this page</span>
      {content.issues.slice(0, 12).map((key) => <button className="linked-chip" key={key} disabled={!onOpen || !jiraConfigured} title={jiraConfigured ? `Open ${key} in context` : "Connect Jira to open this issue"} onClick={() => onOpen({ type: "issue", key, title: key, origin: jiraOrigin })}>{key}</button>)}
      {content.issues.length > 12 && <small>{content.issues.length - 12} more in the document</small>}
    </div>}
    <div className={`document-reader-layout ${content.headings.length ? "with-outline" : ""}`}>
      <div ref={body} className="remote-document" dangerouslySetInnerHTML={{ __html: content.clean }} />
      {content.headings.length > 0 && <nav className="document-outline" aria-label="Document outline">
        <h3>On this page</h3>
        {content.headings.map((heading, index) => <button key={index} className={activeHeading === index ? "active" : ""} aria-current={activeHeading === index ? "location" : undefined} onClick={() => jump(index)} title={heading.title} style={{ paddingLeft: 8 + Math.max(0, heading.level - 2) * 8 }}>{heading.title}</button>)}
      </nav>}
    </div>
  </div>;
}
