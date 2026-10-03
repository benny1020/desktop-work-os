# Orbit — Desktop Work OS

개발자의 하루 업무를 연결하는 Desktop Work OS입니다. 브라우저의 high-fidelity 데모와 Electron의 실제 서비스 연결 모드를 제공합니다.

최신 구현: **연결된 일일 계획·검색·빠른 생성 → 이슈/위키/MR/Pipeline 미리보기 → 다이어그램·코드 리뷰**, Claude 가이드와 개인 일정 확인 실행. 로컬 개발·검증 결과는 [LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)에 기록합니다. 비공개 저장소: [benny1020/desktop-work-os](https://github.com/benny1020/desktop-work-os). 실행 증거·스크린샷·다운로드한 참조 소스는 로컬에 유지합니다. [설정·검증·지원 범위](docs/INTEGRATIONS_AND_REVIEW.md)를 확인하세요.

## 실행

```sh
git clone https://github.com/benny1020/desktop-work-os.git
cd desktop-work-os
npm ci
npm run dev -- --port 5178
```

브라우저: http://127.0.0.1:5178

```sh
npm run desktop   # 프로덕션 빌드 후 Electron 창 실행
npm run build     # dist/ 정적 번들 생성
npm test          # Playwright 워크플로 테스트
npm run test:adapters  # API 계약·인증·위치 매핑 테스트
npm run test:desktop   # 별도 임시 프로필로 실제 Electron / 암호화 검증
npm run test:connected-desktop # 실제 Electron 연결 워크플로 검증
```

처음 사용하는 환경은 `npx playwright install chromium`이 필요할 수 있습니다. Electron은 최초 실행 시 플랫폼에 맞는 바이너리를 내려받습니다.

## 확정 범위와 전제

- Demo workspace에서는 정보 구조와 업무 흐름을 검증합니다. Connected workspace에서는 설정한 서비스의 실제 데이터를 조회·리뷰합니다.
- 1440 × 900 desktop-first. Light / Dark, 좁은 화면 대응, 접히는 Sidebar.
- Demo 시나리오 날짜는 **2025년 10월 3일 금요일**입니다. Connected 계획은 기기의 현재 날짜를 사용합니다. 요청의 Friday / October 3를 재현하는 고정 날짜이며 시스템의 실제 날짜를 의미하지 않습니다.
- 영어 UI와 현실적인 PAY / API / OPS 업무 데이터. 문서와 코드 diff는 각 업무 맥락에 맞게 작성했습니다.
- Electron에서 Jira·Confluence Cloud·GitLab·Claude API를 연결할 수 있습니다. URL·토큰은 별도 입력하며 실제 회사 계정 연결은 사용자 설정 후 확인해야 합니다. Dooray는 설정 메뉴만, Observe는 mock 화면만 제공합니다.
- 데모 변경과 리뷰 초안은 로컬에 보존합니다. 연결 모드에서 명시적으로 제출한 댓글·상태 변경·승인은 해당 서비스 API로 전송합니다. 토큰은 Electron OS 암호화 저장소에 저장하며 renderer/localStorage로 돌려주지 않습니다.
- Electron 런타임 실행을 지원합니다. 서명된 설치 파일, 자동 업데이트, 배포 패키지는 이번 UX 프로토타입 범위 밖입니다.

## 디자인 시스템

| 역할 | Light | Dark |
| --- | --- | --- |
| 작업 배경 | `#FFFFFF` | `#1B2025` |
| 탐색 배경 | `#F7F8FA` | `#171C21` |
| 기본 텍스트 | `#293338` | `#DEE4E8` |
| 보조 텍스트 | `#69757D` | `#A0ACB4` |
| 주 행동 / 선택 | `#267469` | `#79BBAD` |
| Assistant / Review | `#7C6BA9` | `#B8A6DF` |

- DM Sans: UI, 제목, 본문. IBM Plex Mono: 코드와 로그. 웹폰트 로드 실패 시 시스템 폰트 사용.
- 좌측 탐색 → 중앙 작업 공간 → 우측 Inspector / Assistant.
- 화면 이동 순서: Inline action → Preview / Inspector → 전문 작업 공간.
- 4–8px 모서리, 얇은 구분선, 작은 상태 표시, 간결한 표. Home의 장식용 KPI·그래프는 제외했습니다.
- 그래프는 로그의 시간 분포와 스프린트의 실제 샘플 상태 집계에만 사용합니다.

## 화면과 주요 조작

| 화면 | 검증할 수 있는 행동 |
| --- | --- |
| Home / Daily Command Center | 오늘 일정과 업무 확인, 빠른 Preview, Brief에서 리뷰 직접 열기 |
| My Work / Today | 일정·업무 시간순 표시, 완료, 순서 드래그, 내일 이동, 빠른 입력 |
| My Work / This Week | 월–금 계획, Backlog → 요일 드래그, 요일 간 이동 |
| Calendar | Day / Week / Month, 회의·Task 구분, Task를 날짜로 드래그 |
| Projects / Issues | 필터, 프로젝트 선택, 표에서 상태 변경, Inspector |
| Projects / Sprint Board | 상태별 드래그, 키보드·마우스용 상태 선택 메뉴 |
| Issue Inspector | 상태·우선순위·담당자·Sprint·Due 수정, Subtask, 댓글, 연결 객체 탐색 |
| Code / Merge Requests | 저장소·제목 필터, MR Preview, 리뷰 공간 열기 |
| Code / My Reviews | 요청된 리뷰와 승인 상태 확인 |
| MR Review | 의존성/시퀀스 다이어그램, 컴포넌트 → Diff/Source → 위치 댓글, AI 가이드, 승인 |
| Observe / Log Explorer | 환경·서비스·시간·Level·검색 필터, 로그 상세, Trace 필터 |
| Observe / Alerts | Alert → Logs / Deployment / Incident 연결 |
| Docs | Page Tree, 페이지 검색, Favorites, Outline, 관련 업무 Preview |
| Global Search | Issue, Task, MR, Doc, Repo, Project, Log, Incident, Member 검색 |
| Assistant Panel | 현재 화면 Context, 스크립트 기반 제안·초안·확인 후 실행 |
| Assistant Brief | Review / Deadline / Production 이슈와 다음 행동 |

보조 화면: Projects Overview / Roadmap, Repositories / Pipelines / Architecture, Observe Overview / Dashboards / Incidents, Docs Spaces / Recent, Settings의 Integrations / Notifications / Workspace / Preferences. 보조 화면은 핵심 흐름을 지원하는 가벼운 목업입니다.

## 조작 방법

| 단축키 | 동작 |
| --- | --- |
| Cmd / Ctrl + K | Global Search, ↑ ↓ 선택, Enter 열기 |
| Cmd / Ctrl + N | Task / Issue / Document / Incident 생성 |
| Cmd / Ctrl + J | Assistant 패널 |
| G → H / M / P / C / O | Home / My Work / Projects / Code / Observe |
| Escape | Palette / Assistant / Inspector 닫기 |

- 모든 전역 기능은 화면의 버튼으로도 접근할 수 있습니다.
- `PAY-382 tomorrow 2pm`은 기존 업무를 내일로 이동하고 시간을 기록합니다.
- `Check retry queue tomorrow 2pm`은 새 업무를 생성합니다.
- 자연어 입력은 `today / tomorrow / am / pm`의 제한된 로컬 파서입니다. 실제 자연어 모델은 아닙니다.
- Task 왼쪽 Grip을 드래그해 순서를 바꿀 수 있습니다. 보드와 캘린더에서도 같은 데이터를 사용합니다.
- 캘린더 드래그는 날짜 변경입니다. 이벤트 길이 조절, 반복 일정, 정밀 시간 슬롯 편집은 구현하지 않았습니다.
- Inspector 내부 뒤로가기는 연결 객체를 되짚습니다. 상단 Back / Forward는 화면 탐색 이력을 이동합니다.
- 최근 본 항목은 상단 History 아이콘에서 복귀할 수 있습니다.
- Settings → Workspace → Reset sample data에서 시연 데이터를 초기화할 수 있습니다.

## 시나리오별 평가 경로

### Morning

Home에 오늘 일정, Today Task, Assistant Brief가 함께 보입니다. 별도 화면 이동 없이 확인하고, Brief의 **Review changes 한 번**으로 MR Review를 엽니다.

### Development

Projects → PAY-382 → Documentation → Inspector Back → MR !381 → Pipeline #482.

Issue를 선택한 이후 연결 객체 탐색에는 중앙 목록의 화면 이동이 없습니다. 선택한 프로젝트 필터와 목록 맥락을 유지합니다.

### Review

My Reviews → Review → 변경 구조 Node → Diff 줄 → Comment → Discussion → Approve.

Approve는 리뷰 상태만 바꿉니다. Merge 동작은 없습니다.

### Incident

Alerts → Payment error alert → Explore logs → Log 상세 → !376 배포 MR → Inspector Back → Create incident → Create assigned issue.

로그의 서비스·레벨 필터를 유지하고 Incident에 Alert, Log, Deployment를 연결합니다. 후속 Issue는 Sarah Park에게 배정됩니다.

### End of Day

Today → 완료 체크 → Show completed → 남은 업무를 Tomorrow로 이동 → Tomorrow 선택.

Assistant로 이동하면 **Confirm 전에는 데이터가 바뀌지 않습니다.** Cancel은 원래 날짜를 유지합니다.

클릭 수는 구현 경로의 특성입니다. 실제 사용자 대상의 5초 인지 시간이나 2–3분 계획 완료 시간은 아직 측정하지 않았습니다.

## 검증과 증거

최신 연결/다이어그램 구현의 실행 결과와 한계는 [검증 기록](docs/INTEGRATIONS_AND_REVIEW.md#검증)을 기준으로 합니다. 이전 소스 참조 개선 단계에서는 Playwright 19 / 19가 통과했습니다. macOS Electron 창 실행 및 Home 렌더링 확인 완료. 이 결과는 UX 프로토타입 동작 검증이며 실제 외부 서비스 연동이나 사용자 사용성 실험 결과가 아닙니다.

`tests/workflows.spec.js`는 핵심 5개 시나리오와 다음 항목을 검증합니다.

- Issue 상태 수정과 reload 후 지속성
- Review 파일 탐색, 줄 댓글, Discussion, 승인
- Incident 생성 및 담당 Issue 연결
- Assistant Confirm / Cancel 전후 데이터
- 검색 키보드 탐색, 자연어 Quick Create
- Weekly, Board, Calendar, Today의 실제 마우스 드래그
- 모든 Sidebar 하위 탐색 화면의 렌더링과 런타임 오류
- Day / Week / Month, Light / Dark, Sidebar collapse, Back / Forward
- 작은 화면의 가로 overflow

최신 증거는 `artifacts/`의 스크린샷, `artifacts/source-review/test-results.html`, `research/evidence/after-tests.json`에 있습니다. `artifacts/test-report`는 초기 11개 테스트 실행 보고서입니다. Electron 네이티브 실행은 Playwright Electron API로 별도로 실행하여 Home 렌더링과 native class를 확인했습니다.

## 구조

- `src/main.jsx`: App Shell, 상태, 화면, Inspector, Assistant, Command Palette
- `src/data.js`: 연결된 샘플 Issue / MR / Doc / Member / Event / Log
- `src/docData.js`: 문서별 실제 내용
- `src/reviewData.js`: MR 파일별 diff 샘플
- `src/styles.css`: 디자인 토큰, 화면 레이아웃, Light / Dark, 반응형
- `electron/main.cjs`: sandbox + context isolation을 켠 Electron 창
- `tests/workflows.spec.js`: 사용자 행동 기준 E2E 검증

현재 서비스별 토큰 어댑터와 명시적 쓰기 동작을 구현했습니다. 백그라운드 동기화·충돌 해결·감사 이력·mock의 모든 보조 화면과 실데이터 통합은 후속 범위입니다.


## 실제 오픈소스 참조 개선 (2026-10-03)

[소스 검토 및 적용 기록](research/SOURCE_REVIEW.md)에 6개 저장소의 고정 커밋, 실제 읽은 줄 범위, 반영/보류 판단, 수정 전후 테스트를 남겼습니다. 저장소 전체를 읽거나 원본 컴포넌트를 그대로 이식한 것으로 해석하지 않습니다.

- cmdk + Radix 기반 검색: 유형별 결과, IME 보호, Home/End, focus 복귀
- Inspector 확장, 최상위 Escape, 이슈별 댓글 초안 저장 / Cmd+Enter
- GitLab 방식 Viewed 진행도와 private review draft → 명시적 Submit
- 로그 필드 포함/제외 칩, Fields/JSON, 주변 로그, 현재 결과 이전/다음
- 섹션별 목록 검색 조건 보존

`node scripts/capture-source-review.mjs`는 새 상호작용 화면 9장을 캡처합니다. `node scripts/capture-screens.mjs`와 `node scripts/build-gallery.mjs`는 전체 갤러리를 갱신합니다. 로그의 host/deployment/duration 등은 시나리오용 데이터이며 실측값이 아닙니다.

Team 메뉴 및 전용 Members / Schedule / Activity 화면과 Home의 Around your team 영역은 제거했습니다. 담당자 선택과 개인 프로필에 필요한 구성원 데이터는 유지합니다. Docs는 Demo workspace에서 샘플, Connected workspace에서 실제 Confluence 문서 조회·검색·생성을 제공합니다.


## 최신 연결 코드 구조

- `electron/integrations.cjs`: 고정 action API, 서비스별 인증·요청, 암호화 vault
- `electron/preload.cjs`: 제한된 IPC bridge
- `src/components/IntegrationSettings.jsx`: 서비스별 URL·계정·토큰·연결 테스트
- `src/components/ConnectedWorkspace.jsx`: 실제 Jira·Confluence·GitLab 데이터와 Claude Assistant
- `src/components/ReviewWorkbench.jsx`: 다이어그램 / 실제 코드 / 댓글 / AI 가이드
- `src/lib/review-model.mjs`: diff 줄 매핑, import/참조 그래프, AI 근거 검증
- `src/lib/demo-review.js`: 명시적으로 표시한 데모 코드와 가이드

