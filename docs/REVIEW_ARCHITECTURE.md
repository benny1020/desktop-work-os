# 역할별 코드 리뷰와 읽기 쉬운 리뷰 범위

이전 다이어그램은 import 깊이에 따라 `Dependency layer 1`처럼 정렬되어 Controller와 Service를 구별하기 어려웠다. 흐름 선택 메뉴도 디렉터리 이름과 파일 수만 보여주어, 어떤 변경을 먼저 읽어야 하는지 알기 어려웠다.

현재 기본 화면은 **Controller / Entry points → Service / Business logic → Repository / Persistence**처럼 역할별 밴드를 사용한다. UI, Model/Contracts, Integration/Workers, Shared, Tests, Documentation, Configuration, Other도 별도 밴드로 표시한다. 기존 import 깊이 레이아웃은 **By dependency**로 전환할 수 있다.

## 어떻게 변경을 읽는가

1. 범위를 고른다. 예: **Payment request handling** 또는 **Order request handling**. 메뉴에는 실제 구성요소 이름, 파일 수와 읽은 상태가 함께 나온다.
2. 현재 범위의 진입점과 확인된 route를 읽는다. 구성요소 사이의 읽기 경로는 코드에서 확인한 import만 연결한다. 실제 실행 순서를 의미하지 않는다.
3. 다이어그램 구성요소를 눌러 실제 변경 코드 또는 전체 Source를 읽는다. import 선을 누르면 해당 코드 근거 줄로 이동한다.
4. AI 체크포인트를 생성하고 코드와 비교한다. AI 제안을 자신의 초안에 추가하고, 직접 검토한 뒤 **Post to GitLab**을 누른다. 초안 작성·범위 전환·AI 생성만으로 댓글이나 승인이 전송되지 않는다.

**Why these files?**는 그룹을 묶은 근거와 전체 파일 목록을 보여준다. 확인된 import가 없으면 디렉터리/이름 기반 그룹임을 명시한다. 큰 그룹은 `1/3`, `2/3`처럼 구분하고, 마지막 파일도 검색으로 찾을 수 있다.

## 분류와 context 유지

- Spring/Nest Controller, Spring Service/Repository/Entity 등 현재 코드의 annotation이 이름·경로보다 우선한다. 제거된 줄과 주석의 annotation은 현재 역할 근거로 사용하지 않는다.
- 소스를 읽을 수 없거나 annotation이 없으면 명시적인 파일 이름과 역할 디렉터리를 사용하고 **convention**으로 표시한다. 판단 불가/충돌은 **Role unknown / Role ambiguous**로 표시한다.
- 일반 `Mapper`는 Model/Contracts이다. MyBatis import와 `@Mapper`가 함께 확인된 경우 Repository로 분류한다.
- 같은 Java/TS 레이어 폴더에 있어도 `PaymentController / PaymentService`와 `OrderController / OrderService`를 구분한다. import 연결이 있으면 관련 helper를 같은 범위에서 읽는다.
- 그룹당 최대 12개 주 파일과 6개 공유 파일을 유지한다. 모든 변경 파일은 정확히 하나의 주 그룹에 속하며 공유 파일의 초안·Viewed 상태는 중복 생성되지 않는다.
- 범위 전환 후에도 읽던 파일, Source/Diff, 선택 줄, 댓글 초안과 검토 상태가 복구된다. AI 결과가 뒤늦게 도착하면 요청한 범위에 남는다.
- 역할 사이를 거꾸로 연결하는 cycle은 카드 바깥 경로로 그린다. 역할 분류 때문에 import 관계나 cycle을 숨기지 않는다.

## 실제 검증

브라우저 전용 fixture는 같은 Java package 아래 Payment/Order의 Controller–Service–Repository를 배치한다. 실제 회사 서비스와 연결하지 않는다.

- 모델 테스트 **23/23**: Spring/TS 역할, annotation·경로·이름 근거, 모호한 Mapper, 알 수 없는 파일, cycle, 완전한 파일 분할, 입력 순서·AI 추론에 대한 안정성.
- 새 브라우저 테스트 **6/6**: 의미 있는 두 범위와 고유 접근성 이름, 세 역할 밴드, Source/AI/초안 복구, 명시적 댓글 전송 좌표, unknown/config fallback, cycle 선의 마우스·키보드 작동, 29개 파일의 분할 검색, 980×650 dark window.
- 1440×900에서 Controller, Service, Repository 카드 세 개가 동시에 보이는지 geometry를 검사했다. 980×650에서는 선택한 Repository가 표시되고 다이어그램·코드·AI 영역과 메뉴가 화면 밖으로 잘리지 않는지 검사했다.
- source·diff·AI 상호작용은 브라우저 fixture에 대한 검증이다. 회사 GitLab/Claude 인증 및 네트워크 연동 성공을 증명하지 않는다.

```bash
node --test tests/integration/review-flows.test.mjs tests/integration/review-architecture.test.mjs
npx playwright test tests/review-architecture.spec.js --workers=1 --output artifacts/architecture-verified-results
```

실제 실행 화면은 `artifacts/review-architecture-desktop.png`, `review-architecture-picker.png`, `review-architecture-collaboration.png`, `review-architecture-narrow-dark.png`, `review-architecture-narrow-picker.png`에 저장했다.

README용 화면은 [화면 모음](SCREENSHOTS.md)에 포함했다. 최종 전체 회귀 검증은 [개발 검증 기록](LOCAL_DEVELOPMENT.md)에 기록한다.

## PR Lens 참조 범위

[PR Lens의 고정 커밋](https://github.com/coldteadotai/pr-lens/tree/402dc6600b682da48e7191cb067ab355944947e7)을 참조했다. 로컬 보존 원문 `packages/renderer/src/layout/architecture.ts` **1–260줄**에서 레인 순서, 안정적인 좌석 크기, 배지/텍스트 공간을 읽었다. `packages/schema/src/graph.ts` **62–133줄**에서 노드가 하나의 레인에 속하고 근거 파일을 연결하는 모델을 확인했다.

Worklane은 이 interaction과 정보 표현 원칙을 참고한 자체 React/SVG 구현이다. PR Lens renderer를 복사하거나 패키지 전체를 이식하지 않았다. 역할 분류는 변경 파일에서 확보한 코드/경로/이름에 대한 heuristic이며 전체 저장소의 아키텍처나 실제 런타임 호출 순서를 증명하지 않는다.
