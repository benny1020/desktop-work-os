# Orbit — 실제 소스 코드 기반 UX 검토와 적용

검토일: 2026-10-03. 대상: `/Users/roopre/Desktop/playground/desktop-work-os`.

최초 프로토타입은 제품 UX 패턴을 바탕으로 작성했으며 해당 오픈소스를 줄 단위로 분석한 결과물이 아니었다. 이번에는 특정 커밋의 원문을 내려받아 아래 파일과 실행 경로를 직접 확인하고, 앱 상태 처리와 상호작용을 수정했다.

## 검토 범위와 한계

- 6개 저장소의 커밋을 고정했다. 원문·라이선스·설계 문서 **34개 파일 / 8,776줄**을 확보했다.
- 그중 **22개 파일의 명시된 3,398줄 범위**를 코드/설계 검토 범위로 기록했다. 빈 줄·주석 포함 원문 줄 수이며, 전체 저장소나 확보한 모든 코드를 읽었다는 뜻이 아니다.
- 원문 위치, SHA-256, 파일 줄 수: [source-inventory.json](source-inventory.json). 실제 읽은 범위: [reviewed-ranges.json](reviewed-ranges.json). 라이선스 헤더 확인은 코드 검토 줄 수에서 제외했다.
- GitLab GitHub recursive tree 응답은 `truncated=true`이다. 전체 파일 목록을 확보한 것으로 간주하지 않았다. 사용한 파일은 알려진 경로에서 개별로 가져왔다.
- 이 변경은 **interactive mock의 클라이언트 동작**이다. 실제 Jira/GitLab/OpenSearch API, 서버 권한, 공동 편집·충돌, 리뷰 제출 실패/재시도는 검증하지 않았다.
- Linear/Raycast/Notion의 내부 소스는 읽지 않았다. cmdk를 Raycast의 실제 내부 구현이라고 주장하지 않는다.

## 고정한 원본

| 프로젝트 | 커밋 | 참조 파일의 라이선스 기준 |
|---|---|---|
| plane | [c7a5afee6afd](https://github.com/makeplane/plane/commit/c7a5afee6afd15f16038ebda1ec1489ebd8af67d) | AGPL-3.0 (파일 헤더 AGPL-3.0-only) |
| huly | [b426f096ec86](https://github.com/hcengineering/platform/commit/b426f096ec8680e3b9650c8a84b8ca44c76553c6) | EPL-2.0 |
| gitlab | [7aba7128dcd1](https://github.com/gitlabhq/gitlabhq/commit/7aba7128dcd14b202ca79a87d24d171679be0ad2) | 검토한 client-side JavaScript: 루트 LICENSE의 MIT Expat 적용 범위 |
| grafana | [3b3f9b8a7179](https://github.com/grafana/grafana/commit/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f) | AGPL-3.0 |
| opensearch | [e59c5d780db8](https://github.com/opensearch-project/OpenSearch-Dashboards/commit/e59c5d780db846b28c8241ea980f8375618c0cc0) | Apache-2.0 |
| cmdk | [dd2250ed6084](https://github.com/pacocoursey/cmdk/commit/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3) | MIT |

제품 코드에 Plane/Huly/Grafana 컴포넌트를 그대로 복사하지 않았다. 상태 전이와 interaction contract를 참고해 기존 React mock에 작성했다. 실제 패키지 재사용은 `cmdk@1.1.1`과 `@radix-ui/react-dialog@1.1.6`이며 package-lock.json으로 고정했다. 분석에 사용한 원문은 `research/upstream/*/files/`에 저작권 헤더와 원본 LICENSE를 보존했다. 이 조사 폴더는 Vite production bundle에 포함되지 않는다.

## 코드 경로별 판단

| 원본 | 읽은 근거 | 원본에서 확인한 동작 | Orbit에 적용 / 의도적 차이 | 검증 |
|---|---|---|---|---|
| Plane | [header.tsx:39–59](https://github.com/makeplane/plane/blob/c7a5afee6afd15f16038ebda1ec1489ebd8af67d/apps/web/components/issues/peek-overview/header.tsx#L39-L59) | side-peek / modal / full-screen의 표시 방식과 이슈 식별자를 분리한다. | Inspector 확장/축소는 route와 선택 이슈를 바꾸지 않는다. 전체 페이지 이동은 추가하지 않았다. | OSS-04 |
| Plane | [view.tsx:85–113](https://github.com/makeplane/plane/blob/c7a5afee6afd15f16038ebda1ec1489ebd8af67d/apps/web/components/issues/peek-overview/view.tsx#L85-L113) | 다른 모달·드롭다운이 열렸을 때 peek가 같이 닫히지 않도록 하고, 닫힌 뒤 원래 이슈에 포커스를 돌린다. | 검색창 Escape는 검색창만 닫음. Inspector Escape는 원래 목록 버튼으로 포커스 반환. | OSS-01 |
| Plane | [use-peek-overview-outside-click.tsx:17–76](https://github.com/makeplane/plane/blob/c7a5afee6afd15f16038ebda1ec1489ebd8af67d/apps/web/hooks/use-peek-overview-outside-click.tsx#L17-L76) | composedPath와 포털 DOM을 검사한다. 단순 target.contains만으로는 내부 메뉴 클릭을 외부 클릭으로 오인할 수 있다. | 비모달 Inspector는 배경 클릭으로 닫지 않는다. Command dialog의 외부 클릭·포커스는 Radix에 맡긴다. 이 훅 자체는 이식하지 않았다. | 설계 차이 기록 |
| Plane | [root.tsx:218–225](https://github.com/makeplane/plane/blob/c7a5afee6afd15f16038ebda1ec1489ebd8af67d/apps/web/components/issues/peek-overview/root.tsx#L218-L225) | 워크스페이스·프로젝트·이슈 식별자로 읽기 상태를 구성한다. | 화면별 목록 필터, 객체별 댓글 초안을 분리했다. SWR/서버 캐시는 mock 범위 밖이다. | OSS-02 / OSS-04 |
| Plane | [modal.ts:12–20](https://github.com/makeplane/plane/blob/c7a5afee6afd15f16038ebda1ec1489ebd8af67d/packages/utils/src/work-item/modal.ts#L12-L20) | 폼 초기화 시 입력한 제목·설명·우선순위·날짜를 보존할 대상을 명시한다. | 댓글 draft를 이슈 ID로 저장. 다른 이슈의 입력란에 이전 초안이 섞이지 않는다. 원본은 댓글 컴포넌트가 아니므로 동일 구현이라고 주장하지 않는다. | OSS-04 |
| Huly | [popups.ts:151–176](https://github.com/hcengineering/platform/blob/b426f096ec8680e3b9650c8a84b8ca44c76553c6/packages/ui/src/popups.ts#L151-L176) | 스택의 끝부터 찾고, fixed 항목을 건너뛰며, 닫기 재귀를 방지한 뒤 하나만 제거하고 break한다. | 검색 → popover → 알림 → assistant → inspector 순으로 열린 최상위 대상을 하나만 닫는다. Huly 전체 modalStore를 복제하지 않았다. | OSS-01 |
| Huly | [Popup.svelte:63–76](https://github.com/hcengineering/platform/blob/b426f096ec8680e3b9650c8a84b8ca44c76553c6/packages/ui/src/components/Popup.svelte#L63-L76) | 팝업 ID를 key로 두고 modalStore 순서에서 z-index/top 여부를 계산한다. | 검색은 Radix Portal 최상위 layer, Inspector는 workspace 내부 layer. 기존 mock의 고정된 계층에는 이 구성이 충분하다. | OSS-01 |
| GitLab | [viewed.js:17–51](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/rapid_diffs/adapters/viewed.js#L17-L51) | codeReviewId로 viewed 상태를 저장하고 viewed 시 diff를 접는다. mount 때 체크 상태를 복구하되 링크로 진입한 파일은 보이게 한다. | MR ID + 파일명으로 viewed 저장, 체크 시 접기, 다시 열기, 다음 미검토 파일, 파일별 체크. 커밋 변경에 따른 reviewed 무효화는 mock에 없다. | OSS-05 |
| GitLab | [diff_file_header.vue:305–332](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/diffs/components/diff_file_header.vue#L305-L332) · [diff_file_header.vue:430–439](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/diffs/components/diff_file_header.vue#L430-L439) | 파일 헤더 체크박스가 code_review_id와 연결되고 collapse/expand가 함께 처리된다. | Viewed를 diff 헤더에 두고 승인 버튼과 상태를 분리했다. | OSS-05 |
| GitLab | [file_browser.js:15–119](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/diffs/stores/file_browser.js#L15-L119) | 파일 경로와 트리 상태를 관리하고 브라우저 설정을 별도 보존한다. | 검토 상태는 파일 인덱스 대신 파일명에 결합했다. 실제 repository tree/rename/diff 대용량 가상화는 도입하지 않았다. | OSS-05 |
| GitLab | [review_drawer.vue:202–278](https://github.com/gitlabhq/gitlabhq/blob/7aba7128dcd14b202ca79a87d24d171679be0ad2/app/assets/javascripts/batch_comments/components/review_drawer.vue#L202-L278) | 초안 유무에 따라 리뷰를 제출하고 성공한 뒤 autosave와 초안을 정리한다. 실패 시 오류를 보여주며 제출 상태를 해제한다. | Add to review는 private local draft. Submit review에서만 discussion으로 이동하고 선택한 승인/변경 요청을 반영한다. 네트워크 제출·실패 재시도는 구현하지 않았다. | OSS-06 |
| Grafana | [LogDetailsContext.tsx:163–206](https://github.com/grafana/grafana/blob/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f/public/app/features/logs/components/panel/LogDetailsContext.tsx#L163-L206) | query와 현재 선택 로그의 상태를 분리해 상세 대상을 교체한다. | 현재 검색 결과 내 이전/다음 이동, field filter 변경 후에도 선택 이벤트 상세 유지. | OSS-08 |
| Grafana | [LogDetailsContext.tsx:218–235](https://github.com/grafana/grafana/blob/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f/public/app/features/logs/components/panel/LogDetailsContext.tsx#L218-L235) · [LogDetailsContext.tsx:294–301](https://github.com/grafana/grafana/blob/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f/public/app/features/logs/components/panel/LogDetailsContext.tsx#L294-L301) | 상세 폭은 목록 최소 폭을 남기도록 제한하며 로그별 스크롤을 기억한다. | 확장 Inspector의 최대 폭 제한만 적용. 마우스 폭 조절과 이벤트별 스크롤 기억은 이번에 구현하지 않았다. | 보류 |
| Grafana | [LogLineDetailsFields.tsx:230–287](https://github.com/grafana/grafana/blob/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f/public/app/features/logs/components/panel/LogLineDetailsFields.tsx#L230-L287) · [LogLineDetailsFields.tsx:323–374](https://github.com/grafana/grafana/blob/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f/public/app/features/logs/components/panel/LogLineDetailsFields.tsx#L323-L374) | 필드의 포함/제외 callback과 활성 필터 상태를 분리한다. 데이터소스가 지원하는 동작만 노출한다. | 각 필드 + / ×, 현재 연산 활성 표시, query·level·service와 별도 filter chips. 같은 값의 반대 연산은 교체한다. | OSS-07 |
| Grafana | [LogLineDetailsHeader.tsx:104–164](https://github.com/grafana/grafana/blob/3b3f9b8a7179fb1ca8aaf3582231d2a8635e8f9f/public/app/features/logs/components/panel/LogLineDetailsHeader.tsx#L104-L164) | 주변 로그 조회 callback, 상세 모드 변경, 필드 검색/초기화를 나눈다. | Fields / JSON / Surrounding logs와 필드·값 검색. 주변 로그는 메인 검색 조건을 덮어쓰지 않는다. | OSS-07 / OSS-08 |
| OpenSearch | [doc_viewer.tsx:31–71](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/e59c5d780db846b28c8241ea980f8375618c0cc0/src/plugins/discover/public/application/components/doc_viewer/doc_viewer.tsx#L31-L71) | 같은 hit를 각 doc-view 탭에 전달한다. | Fields와 JSON은 같은 logFields(log)에서 파생한다. | OSS-07 |
| OpenSearch | [table_row_btn_filter_add.tsx:27–68](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/e59c5d780db846b28c8241ea980f8375618c0cc0/src/plugins/discover/public/application/components/table/table_row_btn_filter_add.tsx#L27-L68) · [table_row_btn_filter_remove.tsx:27–68](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/e59c5d780db846b28c8241ea980f8375618c0cc0/src/plugins/discover/public/application/components/table/table_row_btn_filter_remove.tsx#L27-L68) | 포함/제외 버튼에 필드·값 이름과 지원 여부를 전달한다. | 포함/제외 버튼에 실제 field/value의 접근성 이름, 필터 제거 버튼 제공. mock은 표시한 구조화 필드만 필터 가능하다. | OSS-07 |
| OpenSearch | [context_query_state.ts:7–31](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/e59c5d780db846b28c8241ea980f8375618c0cc0/src/plugins/discover/public/application/components/doc_views/context/utils/context_query_state.ts#L7-L31) | anchor, predecessors, successors 및 각 loading/error 상태가 독립적이다. | anchor를 표시하고 같은 서비스·환경의 앞뒤 2개 로컬 로그를 보여준다. 별도 query를 사용하는 UX만 재현; 서버 페이지네이션/실패 상태는 없다. | OSS-08 |
| cmdk | [index.tsx:579–638](https://github.com/pacocoursey/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/cmdk/src/index.tsx#L579-L638) | Home/End·방향키·Enter와 IME composition/keyCode 229 예외를 처리한다. | 직접 만든 숫자 index 키보드 핸들러를 제거하고 cmdk 1.1.1을 실제 사용한다. Cmd/Ctrl+J 충돌을 피하도록 vimBindings=false. | OSS-03 |
| cmdk | [index.tsx:664–722](https://github.com/pacocoursey/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/cmdk/src/index.tsx#L664-L722) · [index.tsx:787–823](https://github.com/pacocoursey/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/cmdk/src/index.tsx#L787-L823) | 항목은 고유 value를 가지고, input은 combobox/aria-controls/aria-activedescendant를 구성한다. | type:id 값, 유형별 그룹, 한글 조합 중 실행 방지, 빈 결과 뒤 재검색 복구. 입력의 aria-labelledby가 직접 aria-label보다 우선하므로 root label도 일치시켰다. | OSS-03 |
| cmdk | [index.tsx:882–893](https://github.com/pacocoursey/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/cmdk/src/index.tsx#L882-L893) · [ARCHITECTURE.md:1–98](https://github.com/pacocoursey/cmdk/blob/dd2250ed608443e8f32bafc5fa2d1d07a3746aa3/ARCHITECTURE.md#L1-L98) | Dialog는 Radix와 조합하며 DOM에 실제 존재하는 항목과 안정된 값을 중심으로 선택을 관리한다. | Radix Dialog 1.1.6으로 focus trap/닫기/복귀. 검색 점수기는 사용하지 않고 토큰 AND matching을 명시적으로 적용했다. | OSS-01 / OSS-03 |

## 수정 전 → 수정 후

1. **Escape**: 검색창과 뒤의 Inspector를 함께 닫을 수 있었음 → 현재 최상위 레이어 하나만 닫음, 원래 이슈 버튼으로 포커스 복귀.
2. **화면 전환**: 단일 filter 문자열과 navigate의 초기화 → 섹션별 필터 보존. Back/Forward에서도 목록 검색 유지.
3. **검색**: 수제 numeric index, 빈 결과에서 -1 가능, input 접근성 불완전 → cmdk의 안정된 value와 combobox, IME 보호, Home/End, multiword 검색.
4. **이슈 작성**: 닫을 때 댓글 입력 유실 → 이슈 ID별 local draft 복원과 Ctrl/Cmd+Enter, 같은 객체를 확장 Inspector로 보기.
5. **파일 검토**: 승인만 있고 읽은 파일 진행도 없음 → Viewed / 접기 / 다음 미검토 / 재접속 보존. Viewed가 자동 승인으로 이어지지 않음.
6. **리뷰 초안**: 댓글 즉시 등록만 가능 → 파일·줄 정보와 함께 비공개 로컬 초안 수집, 결과 선택 후 명시적 Submit. 입력 중 draft도 MR·파일·줄별로 보존.
7. **로그 상세**: 필드 읽기만 가능, trace 검색이 기존 query를 덮어씀 → 별도 include/exclude chips, JSON과 필드의 같은 이벤트 원본, trace 필터 추가도 query 보존.
8. **로그 탐색**: 상세 확인 후 다른 로그를 보려면 목록 재클릭 → 현재 결과 이전/다음, 별도 주변 로그 보기. 포함/제외로 anchor가 목록에서 사라져도 상세를 유지하고 Outside results 표시.

## 검증 결과

새 8개 계약 테스트를 변경 전에 실행했다. 결과 **0/8 통과**. 이 중 일부는 기존 결함 재현이고, 일부는 새 동작의 부재를 확인하는 테스트다. 이를 기존 앱 전체가 실패했다는 의미로 해석하지 않는다.

변경 후 기존 11개 업무 흐름 + 신규 8개 = **19/19 통과**. 첫 적용은 17/19였고 검색창 root label/aria-labelledby의 불일치를 수정한 뒤 재실행했다.

- 변경 전 원본: `research/evidence/before-main.jsx`, `before-styles.css`, `before-package.json`
- 변경 전 실행 결과: [before-tests.json](evidence/before-tests.json)
- 변경 후 실행 결과: [after-tests.json](evidence/after-tests.json)
- 재현: `npx playwright test`
- 새 검증: [tests/source-parity.spec.js](../tests/source-parity.spec.js)
- 시각 확인: 실제 1440×900 screenshot으로 검색, 확장 Inspector, Viewed, review draft, 로그 Fields/JSON/context, dark mode를 확인했다.
- 새 화면 증거: [artifacts/source-review](../artifacts/source-review)
- 전체 탐색 화면: [갤러리](../artifacts/screenshots/index.html)

검증은 실제 사용자의 인지 시간, 접근성 전수 감사, 모든 키보드/스크린리더 조합, 대용량 로그 성능을 증명하지 않는다. 네이티브 Electron의 Home 렌더링, Cmd+K, 4개 검색 결과, Escape도 확인했다. [electron-smoke.json](evidence/electron-smoke.json)에 기록했다. 전체 54장과 신규 상태 9장, 총 63장의 브라우저 캡처에서 pageerror는 0개였다.

## 다음 단계로 남긴 원본의 장점

- Grafana: 패널 폭 drag/키보드 resize, 이벤트별 스크롤, virtualization·서버 로그 paging.
- GitLab: 변경 커밋별 viewed 무효화, rename 추적, 네트워크 제출 실패 시 draft 유지와 재시도, 실코드 diff parser.
- Plane/Huly: workspace/프로젝트/사용자별 권한, async optimistic update rollback, 동적 modal stack과 dock persistence.
- OpenSearch: 실제 index mapping에 따른 필터 가능 여부, 주변 로그의 tie-breaker와 anchor/predecessor/successor별 loading/error.
- 검색: 현재 cmdk의 keyboard/selection은 실제 사용하되 mock 데이터 검색은 token AND 방식이다. 서버 전체 검색·ranking·paging은 별도 구현 대상이다.

이 항목은 원본에서 확인했거나 그 구조상 필요한 후속 설계이며, 현재 앱에 구현 완료한 기능으로 표시하지 않는다.
