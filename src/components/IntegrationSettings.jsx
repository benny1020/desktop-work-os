import React, { useEffect, useState } from "react";
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
    description: "프로젝트 · 이슈 · 상태 변경 · 댓글",
    placeholder: "https://hmg.atlassian.net",
    atlassian: true,
  },
  {
    id: "confluence",
    name: "Confluence Cloud",
    description: "위키 · Spaces · 문서 본문",
    placeholder: "https://hmg.atlassian.net/wiki",
    atlassian: true,
  },
  {
    id: "gitlab",
    name: "GitLab Self-Managed",
    description: "MR · 실제 코드 · 다이어그램 리뷰 · 댓글 · 승인",
    placeholder: "https://gitlab.company.com",
  },
  {
    id: "claude",
    name: "Claude · Anthropic API",
    description: "변경 구조 분석 · 리뷰 순서 · 근거 코드 기반 가이드",
    placeholder: "https://api.anthropic.com",
  },
];
export default function IntegrationSettings({ onChange }) {
  const [configs, setConfigs] = useState({});
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState("gitlab");
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (isDesktop())
      invoke("config.list")
        .then(setConfigs)
        .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setForm({ ...configs[selected], token: "" });
  }, [selected, configs]);
  const provider = providers.find((p) => p.id === selected);
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  async function run(kind) {
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
        onChange?.();
        setMessage("저장된 연결 정보를 삭제했습니다.");
      } else {
        const saved = await invoke("config.save", {
          service: selected,
          config: form,
        });
        setConfigs((c) => ({ ...c, [selected]: saved }));
        if (kind === "models") {
          const result = await invoke("claude.models");
          setModels(result.data || []);
          if (result.data?.[0])
            setForm((f) => ({ ...f, model: result.data[0].id }));
          setMessage(
            "모델을 선택한 뒤 Save & test connection을 눌러 확인하세요.",
          );
        } else if (kind === "test") {
          const tested = await invoke("config.test", { service: selected });
          setConfigs((c) => ({ ...c, [selected]: tested }));
          setMessage(`연결 확인 완료 · ${tested.identity || provider.name}`);
        } else
          setMessage(
            "암호화하여 저장했습니다. 연결 테스트로 계정과 접근 권한을 확인하세요.",
          );
        onChange?.();
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
            주소와 계정을 직접 설정합니다. 연결 후 상단에서 Connected
            workspace로 전환하세요.
          </p>
        </div>
        <span className="pill">
          <LockKeyhole size={12} /> OS encrypted storage
        </span>
      </div>
      {!isDesktop() && (
        <div className="info-banner">
          브라우저 데모에서는 토큰을 저장하거나 전송하지 않습니다. 실제 연결은{" "}
          <code>npm run desktop</code>으로 실행한 Electron 앱에서 설정하세요.
        </div>
      )}
      <div className="integration-layout">
        <aside className="provider-list">
          {providers.map((p) => (
            <button
              key={p.id}
              className={selected === p.id ? "active" : ""}
              onClick={() => setSelected(p.id)}
            >
              <Plug size={17} />
              <span>
                <b>{p.name}</b>
                <small>
                  {configs[p.id]?.verifiedAt
                    ? "연결 확인됨"
                    : configs[p.id]?.tokenConfigured
                      ? "저장됨 · 테스트 필요"
                      : "설정 필요"}
                </small>
              </span>
              {configs[p.id]?.verifiedAt && <CheckCircle2 size={15} />}
            </button>
          ))}
          <div className="deferred-provider">
            <b>Dooray</b>
            <span className="pill">메뉴만 제공</span>
            <small>연동 기능은 개발하지 않습니다.</small>
          </div>
          <div className="deferred-provider">
            <b>Observe / OpenSearch</b>
            <span className="pill">Mock</span>
            <small>메뉴와 샘플 화면만 유지합니다.</small>
          </div>
        </aside>
        <form
          className="provider-form"
          onSubmit={(e) => {
            e.preventDefault();
            run("test");
          }}
        >
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
                  ? "저장된 토큰 유지 · 변경하려면 새 토큰 입력"
                  : "토큰 입력"
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
                  placeholder="엔드포인트에서 제공하는 Claude 모델 ID"
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
              <label>
                Workspace ID <small>선택</small>
                <input
                  aria-label="Claude workspace ID"
                  value={form.workspaceId || ""}
                  onChange={(e) => update("workspaceId", e.target.value)}
                  placeholder="워크스페이스 헤더가 필요한 경우에만 입력"
                />
              </label>
              <p className="form-note">
                Anthropic Messages API로 호출합니다. 연결 테스트는 짧은 응답을
                생성하며 소량의 사용량이 발생할 수 있습니다.
              </p>
            </>
          )}
          {provider.atlassian && (
            <details>
              <summary>Scoped API token을 사용하나요?</summary>
              <label>
                Cloud ID <small>선택</small>
                <input
                  aria-label="Atlassian cloud ID"
                  value={form.cloudId || ""}
                  onChange={(e) => update("cloudId", e.target.value)}
                  placeholder="Atlassian 사이트의 Cloud ID"
                />
              </label>
              <p className="form-note">
                범위가 지정된 토큰은 Cloud ID를 입력하면 api.atlassian.com
                게이트웨이로 호출합니다. 일반 토큰은 비워두세요.
              </p>
            </details>
          )}
          {selected === "gitlab" && (
            <p className="form-note">
              Personal Access Token을 사용합니다. 조회에는 read_api /
              read_repository 권한, 리뷰 댓글·승인에는 api 권한이 필요합니다.
              VPN과 사내 인증서는 OS에서 설정하세요.
            </p>
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
        </form>
      </div>
    </div>
  );
}
