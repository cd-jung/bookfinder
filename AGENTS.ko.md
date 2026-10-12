# AGENTS.md - 이 저장소에서 일하는 방법 (한국어 번역본)

> 원본은 `AGENTS.md`(영문)입니다. 내용이 다르면 영문 원본이 기준입니다. 원본을 고치면 이 번역본도 함께 고치세요.

이 파일은 이 프로젝트에서 일하는 모든 AI 에이전트와 개발자의 작업 방법입니다. Claude Code는 `CLAUDE.md`를
통해 이 파일을 읽고, 다른 도구(Codex, Cursor, Copilot, Kiro)는 `AGENTS.md`를 바로 읽습니다.
아키텍처와 각 결정의 이유는 `README.md`에 있습니다.

## 1. 기술 스택 (고정. 바꾸려면 먼저 사용자에게 물어볼 것)

| 계층 | 선택 |
|---|---|
| 프론트엔드 | React + TypeScript + Vite, 모든 UI 컴포넌트는 **MUI**, react-router, **Workers Static Assets**(`frontend/wrangler.jsonc`)에서 서비스 |
| 백엔드 | **Cloudflare Python Workers**(Pyodide) 위의 **Django**(WSGI), `django-cf` 사용 |
| 데이터베이스 | Django ORM으로 쓰는 **Cloudflare D1**(SQLite), 트랜잭션 없음 |
| RAG | 유저 가이드 Markdown -> **Workers AI** 임베딩(`@cf/baai/bge-m3`) -> **Vectorize**, 본문은 D1 |
| LLM | **Workers AI**(`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), 반드시 `backend/src/core/llm.py`를 통해서만 호출 |
| 로그 | 모든 API 요청 -> Workers Logs(stdout)와 `RequestLog` 테이블 |
| 테스트 | pytest + pytest-django, Vitest + Testing Library, Playwright(UX flow 시나리오) |
| CI/CD | GitHub Actions: 모든 push / PR에서 검증, `main`이면 배포 |
| 요금제 | Cloudflare **Workers Paid**(월 $5): Django는 요청당 CPU 약 60ms로 무료 한도 10ms를 넘음. 그래도 낮게 유지(앱 수 최소화, 무거운 import 금지) |

## 2. 저장소 구조

```
AGENTS.md / AGENTS.ko.md     이 작업 방법 (영문 / 한국어)
README.md / README.ko.md     결정 사항, 설정, 새 프로젝트 생성과 인터뷰 진행 순서
project.config.json          이름과 ID. `node scripts/apply-config.mjs`로 반영
backend/                     Python Workers 위의 Django
  src/config/                설정 (DJANGO_ENV = workers | local | test), urls
  src/core/                  llm.py(유일한 LLM 진입점), 미들웨어(CORS, 요청 로그), health
  src/nlsearch/              자연어 -> JSON 필터 -> ORM (Catalog, compiler, translate)
  src/logs/                  RequestLog 모델, 로그 카탈로그, 목록 / 통계 / 번역 API
  src/rag/                   유저 가이드 청킹, 검색, 답변
  tests/                     pytest, 모듈이나 기능마다 파일 하나: test_<app>_*.py
  d1_migrations/             Django 마이그레이션에서 생성. 직접 수정 금지
  scripts/                   export_d1_migrations.py, index_guide.py (CD)
frontend/src/                기능마다 폴더 하나 (chat/, logs/, guide/, ...), 테스트는 코드 옆에
docs/user-guide/             NN-<topic>.md: 유저 가이드 페이지이자 RAG 원본
ux-flows/                    NN-<feature>.md Mermaid 플로차트 + 뷰어 (index.html, build.py)
e2e/                         scenarios/catalog.json, tests/*.spec.js, 커버리지 리포트 스크립트
scripts/                     check-consistency, new-project, build-site, dev, unit-summary
.github/workflows/ci.yml     CI/CD
```

## 3. 기능 단위로 작업하기

**기능**은 사용자가 볼 수 있는 하나의 능력입니다(페이지, 패널, 검색, UI가 쓰는 API).
한 번에 기능 하나씩 작업합니다. 기능을 바꿀 때마다(삭제 포함) **여섯 가지 산출물을 같은 커밋에서 함께** 갱신합니다.

| # | 산출물 | 위치 | 생성 / 수정 / 삭제 시점 |
|---|---|---|---|
| 1 | UX flow | `ux-flows/NN-<feature>.md` | 화면, 상태, 오류, 이동 경로가 바뀔 때 |
| 2 | E2E 시나리오 | `e2e/scenarios/catalog.json`의 journey | flow 노드가 추가, 변경, 삭제될 때 |
| 3 | E2E 테스트 | `e2e/tests/<feature>.spec.js` | 시나리오가 추가, 변경, 삭제될 때 |
| 4 | 유닛 테스트 | `backend/tests/`, `frontend/src/**/*.test.tsx` | 코드가 추가, 변경, 삭제될 때 |
| 5 | 유저 가이드 | `docs/user-guide/NN-<topic>.md` | 사용자가 보거나 하는 일이 바뀔 때 |
| 6 | 코드 | `backend/src/`, `frontend/src/` | - |

작업 순서: **flow -> 시나리오 -> 코드 + 유닛 테스트 -> E2E 테스트 -> 유저 가이드 -> 검증 -> 커밋**.
커밋 메시지: `feat(<feature>): ...`, `fix(<feature>): ...`, `refactor(<feature>): ...`.

### 완료 조건 (`npm run verify`와 Stop hook이 확인)

- [ ] `npm run lint` 통과 (ruff, oxlint, tsc).
- [ ] `npm run test:unit` 통과. 새 코드나 바뀐 코드에는 유닛 테스트가 있고, 삭제된 코드의 테스트는 지웠다.
- [ ] `npm run check` 통과: 모든 시나리오가 실제 flow 노드에 연결되어 있고, 고아 E2E 태그가 없고,
      모든 flow에 journey와 `%% guide` 페이지가 있고, `ux-flows/scenarios.js`가 다시 빌드되었고, D1 마이그레이션이 내보내져 있다.
- [ ] 모든 **core** 시나리오에 E2E 테스트가 있다 (`npm run coverage`. CI는 `--strict`로 확인).
- [ ] `npm run test:e2e` 통과.
- [ ] 유저 가이드가 UI 문구(버튼 글자, 탭 이름, 메시지)를 그대로 쓴다.

## 4. 산출물 규칙

### 4.1 UX flow (`ux-flows/`)

- 기능마다 파일 하나: `NN-<feature>.md`, `# N. 제목`, 한 문단 설명, ```` ```mermaid ```` `flowchart TD` 블록 하나.
- 노드 ID는 짧은 camelCase 단어(`panel`, `noContext`). 시나리오가 `"NN:nodeId"`로 참조하므로
  **노드 이름을 바꾸면 카탈로그도 고쳐야 합니다**.
- 클래스: `screen`(보이는 UI), `hidden`(오류 / 예외 상태), `link`(다른 flow로 이동), `internal`(서버 단계).
  기존 flow의 `classDef` 네 줄을 복사해서 씁니다.
- 지시문(Mermaid 주석): `%% link <nodeId> <file.md>`는 노드를 누르면 다른 flow를 엽니다.
  `%% guide <page>.md`는 이 flow를 설명하는 유저 가이드 페이지입니다(필수).
- `00-overview.md`는 모든 flow를 연결합니다. 수정 후 `npm run flows`를 실행합니다(`scenarios.js` 재생성).

### 4.2 E2E 시나리오 (`e2e/scenarios/catalog.json`)

- flow마다 journey 하나: `{"id", "name", "flow": "NN-<feature>.md", "scenarios": [...]}`.
- 시나리오: `id`(`PREFIX-NNN`, 기능별 접두사, 재사용 금지), `priority`(`core` / `secondary`),
  `rule`(`_priority_rules`에서 선택. core C1-C5가 secondary S1-S5보다 우선), `account`(테스트 컨텍스트),
  `group`, `title`(관찰 가능한 동작), `nodes`(`"NN:nodeId"` 하나 이상).
- 동작을 없애면 그 시나리오와 테스트도 없앱니다.

### 4.3 E2E 테스트 (`e2e/tests/`)

- `<feature>.spec.js`, 시나리오마다 `test()` 하나, 제목은 ID로 시작: `test('[HELP-002] ...')`.
  커버리지 리포트는 이 태그로 테스트와 시나리오를 연결합니다.
- 요소는 role과 접근 가능한 이름으로 먼저 찾고, 그다음 `data-testid`. CSS 선택자나 텍스트 위치 로직은 쓰지 않습니다.
- 로컬 스택은 `LLM_MODE=stub`(결정적)으로 돕니다. `llm_down` / `api_down` 컨텍스트는
  `page.route()` 가로채기를 씁니다(`tests/helpers.js`). 모바일 전용 테스트는 제목에 `@mobile`을 붙입니다.
- sleep 대신 UI를 바꾸는 응답을 기다립니다(`page.waitForResponse`).

### 4.4 유닛 테스트

- 백엔드: `backend/tests/test_<app>_<topic>.py`, pytest-django, 메모리 SQLite, `LLM_MODE=stub`.
  모든 API 엔드포인트: 성공, 입력 검증(400), 도메인 오류(422), LLM 장애(502/503).
  `real` 경로는 `core.llm.generate / embed / vector_query`를 mock해서 테스트합니다.
- 프론트엔드: 컴포넌트 옆에 `<Component>.test.tsx`. 모듈 mock 대신 API 함수를 props로 주입합니다
  (`LogsPage`, `HelpChat` 참고). `test/render.tsx`(`renderAt`)를 씁니다.
- 동작이 없어지거나 바뀌면 테스트를 지우거나 다시 씁니다. 실패하는 테스트를 skip해서 통과시키지 않습니다.

### 4.5 유저 가이드 (`docs/user-guide/`)

- `NN-<topic>.md`, `# 제목`으로 시작. `##` 섹션은 Help 도우미의 링크 앵커가 됩니다
  (slug 규칙은 `rag/chunking.py`와 `guide/slug.ts`가 공유).
- 최종 사용자용으로 씁니다: 무엇을 누르는지, 무엇이 보이는지, 오류가 무슨 뜻인지. 구현 세부 사항은 쓰지 않습니다.
- 이 파일들은 **유저 가이드 메뉴**이자 **RAG 원본**입니다. CD가 바뀐 섹션을 다시 인덱싱합니다.

## 5. 코드 규칙

### 백엔드

- `INSTALLED_APPS`는 최소로 유지합니다(앱마다 Worker 시작 시간과 CPU가 듭니다). 사용자가 정하기 전에는
  admin, auth, session을 넣지 않습니다.
- 모든 LLM / 임베딩 / 벡터 호출은 `core.llm`(`generate`, `embed`, `vector_query`)을 거칩니다. 그래야
  `stub` / `down` / `real` 모드가 어디서나 동작합니다. `workers`나 `js`는 `core/` 밖에서 import하지 않습니다.
- D1: 트랜잭션 없음(`atomic`은 아무 일도 안 함), SQLite 문법, 아주 큰 `IN` 목록 피하기, 목록은 페이지 나누기.
- 모델이 바뀌면 `npm run migrations`(Django 마이그레이션 + `d1_migrations/*.sql`). SQL을 직접 고치지 않습니다.
- 클라이언트 오류는 `{"detail": "..."}`(LLM 오류는 `"code"` 추가). view는 얇게 유지합니다.
- `ruff format`으로 포맷, `ruff check`로 린트.

### 자연어 검색 (반드시 지킬 것)

1. LLM은 SQL이 아니라 **JSON 필터**를 반환합니다. 검색할 모델마다 `nlsearch.Catalog`(ORM 경로가 있는
   필드, 템플릿, 예시)를 정의하고, 프롬프트, 컴파일러, stub 모두 이것을 읽습니다.
2. LLM 출력과 URL의 `nl_filter`는 신뢰하지 않습니다. 그것을 쓰는 **모든** 요청에서 검증합니다.
3. 필드 이름과 ORM 경로는 카탈로그에서만 나옵니다. 값은 바인딩 파라미터로 넘깁니다.
4. 프롬프트에는 카탈로그와 질문만 넣습니다(`<<<QUESTION` 마커 안). 데이터 행이나 비밀 값은 넣지 않습니다.
5. 카탈로그 예시는 LLM few-shot이자 stub 픽스처입니다. 새 기능마다 예시를 하나씩 추가합니다.

### RAG (Help 도우미)

- `RAG_MINIMUM_SIMILARITY`보다 비슷한 유저 가이드 섹션에서만 답합니다. 찾지 못하면 고정 답변을 주고
  **LLM을 호출하지 않습니다**. 출처 링크는 모델 문장이 아니라 검색 결과에서 만듭니다.
- 답변은 짧은 요약 + `/guide/<page>#<section>` 링크입니다.

### 프론트엔드

- MUI 컴포넌트만 씁니다(다른 UI 키트, 별도 CSS 파일 금지). MUI v9: 레이아웃 props는 컴포넌트 props가
  아니라 `sx`에 넣습니다(`<Stack sx={{ alignItems: 'center' }}>`).
- `src/` 안에 기능마다 폴더 하나. API 호출은 `<feature>/api.ts`에서 `api/client.ts`를 통해 합니다.
- 모든 컨트롤에 접근 가능한 이름을 붙입니다(E2E 테스트가 이것에 의존). 반복 항목에는 `data-testid`.
- 새 페이지: `App.tsx`에 라우트, `layout/navItems.ts`에 메뉴, flow, 시나리오, 가이드 페이지.

## 6. 명령어

| 명령어 | 하는 일 |
|---|---|
| `npm run setup` | 전부 설치 (uv, npm, Playwright) |
| `npm run dev` | Django :8000 (SQLite, LLM stub) + Vite :5173 |
| `npm run lint` | ruff + oxlint + tsc |
| `npm run test:unit` | pytest + Vitest 커버리지 포함 -> `coverage/unit-summary.json` |
| `npm run test:e2e` | 로컬 스택에 Playwright 실행 |
| `npm run check` | 정합성 검사 (`-- --strict`를 붙이면 core 시나리오 누락 시 실패) |
| `npm run coverage` | 터미널에 E2E 시나리오 커버리지 출력 |
| `npm run build:site` | 앱 + 커버리지 리포트(`/coverage`에 표시) + `/ux-flows/` 뷰어를 `frontend/dist`에 빌드 |
| `npm run migrations` | Django 마이그레이션 + D1 SQL 내보내기 |
| `npm run verify` | 배포 전에 CI가 돌리는 전부 |

## 7. 의사결정과 소통

- 사용자가 정할 결정: 비용이 드는 것(유료 플랜, 새 서비스), 1장의 스택 변경, 데이터 삭제, 보안이나 저장하는
  데이터의 변경. 실행 전에 물어봅니다.
- 그 밖의 것(이름, 구조, 테스트 설계)은 이 파일을 따라 스스로 정하고 요약에 적습니다.
- 결과는 정직하게 보고합니다: 실패한 테스트, 건너뛴 단계, 알려진 빈틈을 요약에 적습니다.
