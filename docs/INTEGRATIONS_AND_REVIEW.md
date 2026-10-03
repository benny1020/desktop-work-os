# Visual review + token integrations

구현일: 2026-10-03. 최신 연결 워크플로 확장과 검증은 [로컬 개발 검증 기록](LOCAL_DEVELOPMENT.md)을 참고하세요. 브라우저의 UX 데모와 Electron의 실제 연결 모드를 구분합니다.

## 사용 순서

1. `npm run desktop`으로 Electron을 실행합니다.
2. Settings → Integrations에서 서비스별 URL과 토큰을 입력합니다.
3. Save & test connection을 눌러 계정 접근을 확인합니다. 테스트 실패 시 토큰이 암호화되어 저장되어 있을 수 있으며, 상태는 '저장됨 · 테스트 필요'로 남습니다.
4. 상단 Demo workspace를 Connected workspace로 전환합니다.
5. Code → Merge Requests / My Reviews → MR을 선택합니다.
6. Dependency flow / Sequence에서 컴포넌트 또는 화살표를 클릭합니다. 오른쪽 Diff / Source에서 실제 코드를 확인하고 줄을 선택합니다.
7. Post to GitLab은 명시적으로 눌렀을 때만 전송합니다. Approve MR은 확인 후 승인만 실행하며 merge하지 않습니다.
8. Generate AI guide는 현재 MR diff와 사용자가 입력한 팀 가이드라인을 설정한 Claude 엔드포인트로 보냅니다. 노드 탐색·MR 열기만으로 AI를 호출하지 않습니다.

브라우저에서는 토큰 입력/저장을 막고 데모 코드와 샘플 가이드를 제공합니다. 실제 연결을 흉내 내는 성공 응답으로 대체하지 않습니다.

## 연결 설정

| 서비스 | 입력 | 현재 실제 구현 |
|---|---|---|
| Jira Cloud | 사이트 URL, Atlassian 이메일, API 토큰, 선택적 Cloud ID | JQL 검색/다음 페이지, 이슈/보드/로드맵, 상태·담당자·기한·우선순위·스프린트 변경, 댓글, 이슈 생성 |
| Confluence Cloud | 별도 사이트 URL, 이메일, API 토큰, 선택적 Cloud ID | Spaces, 문서 목록/커서, 본문 읽기, 본문 검색, 최근/즐겨찾기, 문서 생성 |
| GitLab Self-Managed | 서비스 기본 URL, Personal Access Token | 저장소 목록, 전체/내 리뷰 MR, 변경 파일, 커밋 고정 원문, 토론 조회, 위치 댓글/파일 댓글, 승인, MR별 Pipeline과 Job 단계 |
| Claude | Anthropic 호환 기본 URL, API 토큰, Model ID, 선택적 Workspace ID | 모델 목록 조회, 연결 테스트, 구조화된 MR 리뷰 가이드, 현재 선택 맥락·개인 계획을 받는 Assistant |
| Dooray | 메뉴만 | API 코드 없음 |
| Observe / OpenSearch | mock 메뉴·화면 | API 코드 없음 |

Jira와 Confluence URL은 서로 독립적입니다. Jira URL은 사이트 기본 주소, Confluence는 기본 주소 또는 `/wiki`까지 입력합니다. GitLab `/api/v4`, Claude `/v1` 또는 `/v1/messages` 접미사는 정규화합니다. 하위 경로에 배포된 GitLab/AI 게이트웨이도 기본 경로를 유지합니다.

Atlassian의 일반 API 토큰은 이메일+토큰 Basic 인증을 사용합니다. Scoped API token은 Cloud ID 입력 시 공식 `api.atlassian.com/ex/...` 경로로 전송합니다. Cloud ID를 자동 추정하거나 임의의 회사 도메인을 하드코딩하지 않습니다.

Claude 모델 ID는 해당 엔드포인트가 제공하는 값을 사용합니다. Fetch available models로 조회할 수 있고, 게이트웨이가 `/v1/models`를 지원하지 않으면 직접 입력합니다. 연결 테스트는 짧은 Messages 요청을 실행하므로 소량의 사용량이 발생할 수 있습니다.

## 다이어그램의 의미

- Dependency flow: 파일이 컴포넌트입니다. 실제 상대 import 경로로 연결한 간선과 추론 간선을 구분합니다. 같은 파일명의 다른 경로를 동일 객체로 취급하지 않습니다.
- Sequence: 호출 지점 또는 AI가 제안한 순서를 표시합니다. 테스트 파일의 호출과 생성자 선언은 기본 정적 시퀀스에서 제외합니다. 모든 순서는 **추론이며 실제 런타임 trace가 아닙니다**.
- 모든 노드는 실제 MR의 파일 경로에 연결됩니다. 화살표와 AI reading order/checkpoint는 근거 줄을 선택합니다.
- GitLab Source는 head SHA에서 파일을 읽습니다. 삭제된 파일은 base SHA에서 읽습니다. 원문 로드 실패·binary·서버 diff 제한은 화면에 표시합니다.
- 정적 분석은 간단한 import/참조 탐색입니다. 전체 저장소 AST, 다형성, DI 컨테이너, 서비스 간 런타임 의존성을 완전히 해석하지 않습니다. 그런 관계는 Claude의 추론으로 표시합니다.
- AI JSON의 파일·새 줄 번호·간선 대상이 현재 diff에 존재하는지 확인합니다. 잘못된 참조는 제거하고 제거 수를 표시합니다. '참조가 존재함'이 AI 판단의 정확성을 보증하지는 않습니다.
- AI 가이드는 diff 기반입니다. 파일당 24,000자, 전체 120,000자 범위를 제한하고 포함 파일 수와 부분 분석 여부를 표시합니다. 토큰 상한으로 응답이 끊기면 가이드를 적용하지 않습니다.

## 리뷰 코멘트와 상태 안전성

- diff parser는 각 hunk의 old/new 시작 줄을 읽습니다. 화면 표시 인덱스를 GitLab 줄 번호로 보내지 않습니다.
- 추가 줄은 new_line, 삭제 줄은 old_line, context 줄은 두 위치를 함께 전달합니다.
- 댓글에는 base/start/head SHA와 old/new 파일 경로를 지정합니다. diff 밖의 Source 줄은 파일 수준 토론으로 올리고 경로·줄·SHA를 본문에 남깁니다.
- MR 로드 전후의 head SHA를 비교해 섞인 스냅샷을 거부합니다. 댓글 제출 직전에도 최신 head SHA를 확인합니다. 승인에는 서버 검사용 SHA를 함께 보냅니다.
- 초안은 MR 주소/프로젝트/번호/head SHA/파일/old 또는 new/줄별로 구분하여 로컬에 보존합니다. 요청 실패 시 지우지 않으며 자동으로 재전송하지 않습니다.
- 네트워크 단절처럼 서버 처리 결과가 불명확할 때는 Refresh 후 토론을 확인하고 재제출해야 합니다. 서버가 제공하지 않는 exactly-once 보장을 주장하지 않습니다.

## 저장 및 실행 경계

- URL·이메일·토큰 등 설정 전체를 Electron `safeStorage`로 암호화하여 userData의 `integrations.enc`에 저장합니다. OS 암호화가 없거나 Linux basic_text이면 저장을 거부합니다.
- 토큰을 localStorage에 넣지 않습니다. renderer에 설정을 돌려줄 때 토큰은 제외하고 tokenConfigured만 반환합니다.
- 도메인/계정/Cloud ID를 변경하면 토큰을 다시 입력해야 합니다. 이전 토큰을 새 목적지에 자동 전달하지 않습니다.
- 서비스 요청은 Electron main의 고정된 action 목록으로만 수행합니다. renderer에는 임의 URL fetch, 파일 읽기, shell 실행 API를 노출하지 않습니다.
- IPC는 앱의 main frame에서만 허용합니다. 외부 window/navigation을 막고, production renderer의 네트워크는 CSP로 제한합니다.
- 서비스 요청은 Electron net.fetch의 Chromium 네트워크 계층을 사용해 시스템 프록시 설정을 따릅니다. API 토큰 외 브라우저 쿠키는 보내지 않습니다.
- HTTPS와 정상 인증서 검증을 사용합니다. 리다이렉트는 따라가지 않습니다. HTTP 실패 응답 본문/토큰을 오류 메시지에 그대로 노출하지 않습니다.
- Confluence HTML은 DOMPurify로 정화하며 script, form, iframe, 외부 이미지·리소스 및 링크 탐색을 제외합니다. 일부 Confluence macro/attachment 표현은 지원하지 않습니다.

## 검증

2026-10-03 실행 결과: **어댑터 17/17, 브라우저 전체 27/27 통과**. 마지막 의존성 경로 해석 수정 후 관련 브라우저 8/8도 통과했습니다. 실제 Electron의 암호화 저장·복원·삭제, IPC, 네이티브 네트워크 인증 헤더 확인도 통과했습니다. 전체 화면 갤러리는 70장입니다.

- Node adapter/보안·위치 매핑 검증: `npm run test:adapters`.
- 브라우저 동작: `npm test`. 기존 19개 + 새 다이어그램/연결 화면 8개.
- 실제 Electron/OS 암호화/IPC: `npm run test:desktop`. 별도 임시 userData만 사용하고 테스트 후 제거합니다.
- 증거: `research/integration-review/adapter-tests.txt`, `browser-tests.json`, `visual-tests-final.json`, `electron-tests.json`.
- 화면: `artifacts/visual-review/`, 전체 갤러리 `artifacts/screenshots/index.html`.

Adapter 테스트는 로컬 HTTP fixture 서버를 사용해 실제 요청 메서드·경로·인증 헤더·본문과 오류 처리를 검증합니다. 브라우저 연결 테스트는 bridge fixture를 사용합니다. Electron 테스트는 실제 OS 암호화 저장소와 main/preload/renderer 경계를 통과합니다. HTTPS protocol fixture로 Electron net.fetch까지 호출해 인증 헤더를 확인하며, 회사 서버에 접속한 테스트는 아닙니다.

**사용자의 회사 도메인·실제 토큰이 제공되지 않았으므로, HMG Atlassian·사내 GitLab·사용자 Claude 엔드포인트와의 실제 왕복 호출은 아직 검증하지 않았습니다.** 테스트 성공을 실서비스 연결 완료로 표현하지 않습니다.

## 연결 워크플로와 지원 경계

Connected workspace의 Home/My Work는 하나의 개인 계획을 Today·Week·Backlog·Calendar로 보여줍니다. 개인 Task/Event와 Jira/MR 연결 항목을 생성·완료·편집·이동할 수 있습니다. 개인 계획과 최근/즐겨찾기는 localStorage에 저장하며 암호화 토큰 저장소와 구분됩니다. 업무 제목·계획 등 로컬 데이터는 평문이고 기기 간 동기화하지 않습니다. 체크/날짜 이동은 Jira 상태/기한을 자동 변경하지 않습니다.

Global Search는 개인 계획, Jira 이슈, 열린 GitLab MR/저장소, Confluence 본문을 조회합니다. Quick Create는 개인 Task, Jira 이슈, Confluence 문서를 생성합니다. 회사 프로젝트에 미지원 필수 custom field가 있으면 누락한 채 생성하지 않고 해당 필드명을 표시합니다. 문서 생성은 plain text를 escape한 storage body를 게시합니다. 기존 Confluence 페이지의 rich-text 편집·macro·attachment 수정은 지원하지 않습니다.

Projects의 Overview/Board/Sprint/Roadmap은 현재 JQL로 로드한 이슈를 투영합니다. Sprint 화면의 범위는 JQL의 sprint 조건으로 지정합니다. Inspector의 Sprint 변경은 Jira Software의 Scrum board와 active/future sprint를 조회해 명시적으로 실행합니다. Roadmap은 기한순 계획이며 epic dependency Gantt는 아닙니다.

이슈 → 관련 MR/위키 → Pipeline/Job을 중첩 미리보기로 탐색하고 뒤로 돌아올 수 있습니다. 이슈 키로 검색한 MR/문서는 검색 후보라는 점을 표시합니다. 전체 자동 연결 그래프나 검증된 관계로 가장하지 않습니다. Assistant의 로컬 내일 이동은 명령을 인식한 뒤 구체적인 날짜 제안/Confirm을 거칩니다. 다른 답변은 읽기/제안이며 외부 실행 도구는 없습니다.

백그라운드 동기화, 오프라인 외부 쓰기/충돌 해결, GitLab merge, 저장소 전체 정밀 AST 분석은 지원하지 않습니다. MR 파일은 최대 500개, 토론은 최대 300개, Pipeline Job은 최대 300개, Scrum board/sprint는 첫 50개까지 조회합니다. 검색·Home 피드는 서비스별 첫 페이지이며 화면에서 범위를 알립니다. 개별 응답 8 MB, Source 600 KB 제한이 있습니다. Dooray 메뉴/Observe mock은 요청대로 유지합니다.

## 확인한 원본과 API 문서

PR Lens 커밋: `402dc6600b682da48e7191cb067ab355944947e7`.

- [graph.ts](https://github.com/coldteadotai/pr-lens/blob/402dc6600b682da48e7191cb067ab355944947e7/packages/schema/src/graph.ts#L62-L132): 노드·간선에 source file reference를 붙이는 구조. 1–330줄 범위를 읽었습니다.
- [FlowMessage / Flow](https://github.com/coldteadotai/pr-lens/blob/402dc6600b682da48e7191cb067ab355944947e7/packages/schema/src/graph.ts#L201-L250): dependency와 ordered sequence를 별도로 표현합니다.
- [walkthrough.ts](https://github.com/coldteadotai/pr-lens/blob/402dc6600b682da48e7191cb067ab355944947e7/packages/schema/src/walkthrough.ts#L18-L130): 단계와 인용 대상의 관계. 1–130줄을 읽었습니다.
- [integrity.ts](https://github.com/coldteadotai/pr-lens/blob/402dc6600b682da48e7191cb067ab355944947e7/packages/schema/src/integrity.ts#L39-L115): 누락된 node/participant 참조 검증. 1–130줄을 읽었습니다.

원문은 `research/integration-review/pr-lens/`에 보존했습니다. renderer layout 파일은 확보했지만 이번 검토/이식 범위에 포함하지 않았습니다. PR Lens 패키지 전체나 renderer를 복사한 구현이 아니라, 분리된 graph/sequence와 근거 참조 모델을 참고한 앱 내부 React/SVG 구현입니다.

공식 API 계약:

- [GitLab merge requests](https://docs.gitlab.com/api/merge_requests/), [Discussions / diff position](https://docs.gitlab.com/api/discussions/)
- [Jira Cloud API token 인증](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/), [Enhanced JQL search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Confluence Cloud pages v2](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/)
- [Anthropic API overview](https://platform.claude.com/docs/en/api/overview)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [DOMPurify](https://github.com/cure53/DOMPurify)
