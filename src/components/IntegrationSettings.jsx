import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Link2,
  LockKeyhole,
  Plug,
  Trash2,
  Loader2,
} from "lucide-react";
import { invoke, isDesktop } from "../lib/integration-client";
const providers = [
  {
    id: "jira",
    name: "Jira Cloud",
    description: "Projects · issues · status updates · comments",
    placeholder: "https://your-company.atlassian.net",
    atlassian: true,
  },
  {
    id: "confluence",
    name: "Confluence Cloud",
    description: "Wiki · spaces · documents",
    placeholder: "https://your-company.atlassian.net/wiki",
    atlassian: true,
  },
  {
    id: "gitlab",
    name: "GitLab Self-Managed",
    description: "Merge requests · code · diagrams · comments · approvals",
    placeholder: "https://gitlab.company.com",
  },
  {
    id: "claude",
    name: "Claude · Anthropic API",
    description: "Change summaries · review guidance · code references",
    placeholder: "https://api.anthropic.com",
  },
];
export default function IntegrationSettings({ onChange }) {
  const [configs, setConfigs] = useState({});
  const drafts = useRef({});
  const [loading, setLoading] = useState(isDesktop());
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState("gitlab");
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (isDesktop()) invoke("config.list")
      .then((data) => { if (active) { setConfigs(data); setForm({ ...data.gitlab, token: "" }); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function selectProvider(service) {
    if (busy || loading || service === selected) return;
    drafts.current[selected] = form;
    setSelected(service);
    setForm(drafts.current[service] || { ...configs[service], token: "" });
    setError("");
    setMessage("");
  }
  const provider = providers.find((p) => p.id === selected);
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  async function run(kind) {
    if (busy || loading) return;
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      if (kind === "remove") {
        await invoke("config.remove", { service: selected });
        setConfigs((c) => {
          const n = { ...c };
          delete n[selected];
          return n;
        });
        delete drafts.current[selected];
        setForm({ token: "" });
        if (selected === "claude") setModels([]);
        onChange?.();
        setMessage("Saved connection removed.");
      } else {
        const saved = await invoke("config.save", {
          service: selected,
          config: form,
        });
        drafts.current[selected] = { ...saved, token: "" };
        setForm(drafts.current[selected]);
        setConfigs((c) => ({ ...c, [selected]: saved }));
        onChange?.();
        if (kind === "models") {
          const result = await invoke("claude.models");
          setModels(result.data || []);
          if (result.data?.[0] && !saved.model?.trim()) {
            drafts.current[selected] = { ...drafts.current[selected], model: result.data[0].id };
            setForm(drafts.current[selected]);
          }
          setMessage(
            "Choose a model, then select Save & test connection.",
          );
        } else if (kind === "test") {
          const tested = await invoke("config.test", { service: selected });
          setConfigs((c) => ({ ...c, [selected]: tested }));
          setMessage(`Connection verified · ${tested.identity || provider.name}`);
        } else
          setMessage(
            "Saved securely. Test the connection to verify your account and access.",
          );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="integration-manager">
      <div className="integration-intro">
        <div>
          <h2>Connect your workspace</h2>
          <p>
            Connect your services, then choose Connected workspace in the top bar.
          </p>
        </div>
        <span className="pill">
          <LockKeyhole size={12} /> OS encrypted storage
        </span>
      </div>
      {!isDesktop() && (
        <div className="info-banner">
          The browser preview does not save or send tokens. Set up connections in the desktop app, launched with <code>npm run desktop</code>.
        </div>
      )}
      <div className="integration-layout">
        <aside className="provider-list">
          {providers.map((p) => (
            <button
              key={p.id}
              className={selected === p.id ? "active" : ""}
              disabled={!!busy || loading}
              onClick={() => selectProvider(p.id)}
            >
              <Plug size={17} />
              <span>
                <b>{p.name}</b>
                <small>
                  {configs[p.id]?.verifiedAt
                    ? "Verified"
                    : configs[p.id]?.tokenConfigured
                      ? "Saved · test needed"
                      : "Not configured"}
                </small>
              </span>
              {configs[p.id]?.verifiedAt && <CheckCircle2 size={15} />}
            </button>
          ))}
          <div className="deferred-provider">
            <b>Dooray</b>
            <span className="pill">Menu only</span>
            <small>Connection is not implemented.</small>
          </div>
          <div className="deferred-provider">
            <b>Observe / OpenSearch</b>
            <span className="pill">Mock</span>
            <small>Sample screens only.</small>
          </div>
        </aside>
        <form
          className="provider-form"
          onSubmit={(e) => {
            e.preventDefault();
            run("test");
          }}
        >
          <fieldset disabled={!!busy || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
          {loading && <p role="status">Loading saved connections…</p>}
          <div className="provider-heading">
            <Link2 size={21} />
            <div>
              <h2>{provider.name}</h2>
              <p>{provider.description}</p>
            </div>
          </div>
          <label>
            Service URL
            <input
              aria-label="Service URL"
              type="url"
              value={form.url || ""}
              onChange={(e) => update("url", e.target.value)}
              placeholder={provider.placeholder}
              required
              autoComplete="off"
            />
          </label>
          {provider.atlassian && (
            <label>
              Atlassian account email
              <input
                aria-label="Atlassian email"
                type="email"
                value={form.email || ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="off"
              />
            </label>
          )}
          <label>
            API token
            <input
              aria-label="API token"
              type="password"
              value={form.token || ""}
              onChange={(e) => update("token", e.target.value)}
              placeholder={
                configs[selected]?.tokenConfigured
                  ? "Keep saved token, or enter a replacement"
                  : "Enter your API token"
              }
              required={!configs[selected]?.tokenConfigured}
              autoComplete="new-password"
              disabled={!isDesktop()}
            />
          </label>
          {selected === "claude" && (
            <>
              <label>
                Model ID
                <input
                  list="claude-model-options"
                  aria-label="Claude model ID"
                  value={form.model || ""}
                  onChange={(e) => update("model", e.target.value)}
                  placeholder="A Claude model ID supported by your endpoint"
                  required
                />
                <datalist id="claude-model-options">
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </datalist>
                <button
                  className="btn model-fetch"
                  type="button"
                  disabled={
                    !!busy ||
                    !isDesktop() ||
                    !form.url ||
                    (!form.token && !configs.claude?.tokenConfigured)
                  }
                  onClick={() => run("models")}
                >
                  Fetch available models
                </button>
              </label>
              <details><summary>Advanced endpoint options</summary><label>
                Workspace ID <small>optional</small>
                <input
                  aria-label="Claude workspace ID"
                  value={form.workspaceId || ""}
                  onChange={(e) => update("workspaceId", e.target.value)}
                  placeholder="Only if your endpoint requires a workspace header"
                />
              </label></details>
              <p className="form-note">
                Testing sends a short request to your Anthropic-compatible endpoint and may incur a small usage charge.
              </p>
            </>
          )}
          {provider.atlassian && (
            <details>
              <summary>Using a scoped API token?</summary>
              <label>
                Cloud ID <small>optional</small>
                <input
                  aria-label="Atlassian cloud ID"
                  value={form.cloudId || ""}
                  onChange={(e) => update("cloudId", e.target.value)}
                  placeholder="Your Atlassian site Cloud ID"
                />
              </label>
              <p className="form-note">
                For a scoped token, enter your Cloud ID to use the api.atlassian.com gateway. Leave this blank for a classic token.
              </p>
            </details>
          )}
          {selected === "gitlab" && (
            <details><summary>Required token permissions</summary><p className="form-note">
              Use a Personal Access Token. Read access requires read_api / read_repository; comments and approvals require api. Configure your company VPN and certificates in your operating system.
            </p></details>
          )}
          {error && (
            <div className="connection-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="connection-success" role="status">
              {message}
            </div>
          )}
          <div className="integration-actions">
            <button
              className="btn primary"
              type="submit"
              disabled={!!busy || !isDesktop()}
            >
              {busy && <Loader2 size={14} className="spin" />}Save & test
              connection
            </button>
            <button
              className="btn"
              type="button"
              disabled={!!busy || !isDesktop()}
              onClick={() => run("save")}
            >
              Save
            </button>
            {configs[selected] && (
              <button
                className="quiet-button"
                type="button"
                disabled={!!busy}
                onClick={() => run("remove")}
              >
                <Trash2 size={13} /> Remove connection
              </button>
            )}
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
