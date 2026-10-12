# 풀스택 Cloudflare 템플릿 (한국어 번역본)

> 원본은 `README.md`(영문)입니다. 내용이 다르면 영문 원본이 기준입니다.

새 앱을 시작할 때마다 쓰는, 비어 있지만 실제로 동작하는 프로젝트입니다. 자동화가 모두 들어 있습니다:
Cloudflare Workers Static Assets(새 Cloudflare Pages)의 React + MUI 프론트엔드, Cloudflare Python Workers + D1의 Django API, Help 도우미
(유저 가이드 기반 RAG), 자연어 로그 검색과 모니터링 대시보드, UX flow 기반 유닛 + E2E 테스트, 커버리지
페이지, 그리고 `main`에 통과한 push를 자동 배포하는 CI/CD.

작업 방법: [AGENTS.ko.md](AGENTS.ko.md) (영문 원본 [AGENTS.md](AGENTS.md)).

## BookFinder (이 프로젝트)

2026-10-12에 이 템플릿으로 만들었고, `poc_samples.zip`(UX flow, E2E 카탈로그, 자연어 검색 가이드, RAG PoC)을 따랐습니다.

| | |
|---|---|
| 앱 | https://bookfinder.kookastudios.workers.dev |
| API | https://bookfinder-api.kookastudios.workers.dev/api/health |
| 커버리지 | https://bookfinder.kookastudios.workers.dev/coverage/ |
| 데이터 | 생성한 책 10,000권 (`backend/src/books/seed.py`, 결정적. 실제 제목 몇 개를 기준점으로 쓰고, 가격과 재고는 모두 가상) |
| 테스트 | E2E 시나리오 114개 (core 43개, 커버리지 100%), 백엔드 + 프론트엔드 유닛 테스트 |

템플릿 위에 더한 프로젝트 결정:

| 주제 | 결정 | 이유 |
|---|---|---|
| 챗봇 | 명세의 "Ask the librarian"을 **Help** 도우미로 변경: 유저 가이드만 근거로 하는 RAG, 짧은 답변 + 링크 | 사용자 결정: 챗봇은 서비스 사용법만 안내하고, 책 데이터는 Vectorize에 넣지 않음 |
| 삭제한 시나리오 | `DET-007`(이 책에 대해 질문), `CHAT-008`(책 문맥 칩), `CHAT-010`(추천 책), `GRD-004`(오래된 가격), `SAFE-003`(책 설명 속 지시문) | 카탈로그 챗봇에서만 의미가 있음 |
| 바꾼 시나리오 | `CHAT-002` 토큰 스트리밍 없음(답이 한 번에 나오고 `CHAT-006` Stop은 요청 취소), `CHAT-007` 후속 질문은 이전 질문을 검색에 함께 사용, `GRD-005` 한국어 답변은 배포 사이트에서 확인(`@real`) | Python Workers + Workers AI는 응답을 한 번에 돌려주고, stub은 번역을 못 함 |
| 데이터 모델 | 넓은 `Book` 테이블 하나. 저자 / 장르 / 형식은 조인 테이블 대신 `\|a\|b\|` 토큰 텍스트 | D1 무료 플랜: 하루 쓰기 10만 행 (시드에 약 5.1만 사용) |
| 읽기 예산 | 검색 한 번에 D1 행을 최대 약 2만 개 읽음 (전체 수 + 패싯 개수 한 번, 현재 페이지 한 번) | 하루 읽기 500만 행 무료 한도로 약 250번 검색. 데모에는 충분 |
| 자연어 안전장치 | D1에는 Postgres 읽기 전용 트랜잭션 / statement timeout이 없음. ORM `filter()`만 쓰고, 필터를 두 번 검증하고, 느리면 "Search took too long" 표시 | D1에는 `SET LOCAL`이 없음 |
| 요청 제한 | `/api/nl-search/translate`와 `/api/rag/answers`에 클라이언트당 분당 10회 (429 + Retry-After), `RequestLog`로 계산 | 다른 서비스 없이 Worker isolate끼리 공유. 로컬 E2E에서는 끔(`RATE_LIMITS=0`) |
| 시드 | CD 단계 `scripts/seed_d1.sh`가 `books_book`이 비어 있을 때만 한 번 책을 넣음 | 반복 쓰기 방지 |

---

## 1. 새 프로젝트 시작하기 (약 5분)

```bash
~/Dev/fullstack-template/scripts/new-project.sh my-app "My App"
```

이 명령은 템플릿으로 private GitHub 저장소 `cd-jung/my-app`을 만들고, Cloudflare D1 데이터베이스,
Vectorize 인덱스를 만들고, `project.config.json`을 채우고, macOS 키체인에서
`CLOUDFLARE_API_TOKEN` 시크릿을 설정한 뒤 push합니다. push하면 CI/CD가 테스트하고 배포합니다.

| 항목 | URL |
|---|---|
| 앱 | `https://my-app.kookastudios.workers.dev` |
| API | `https://my-app-api.kookastudios.workers.dev/api/health` |
| 커버리지 | `https://my-app.kookastudios.workers.dev/coverage/` |
| UX flow | `https://my-app.kookastudios.workers.dev/ux-flows/` |

그다음 새 폴더를 Claude Code로 열고 `/feature <설명>`으로 기능을 만듭니다.
GitHub 저장소를 public으로 만들려면 `--public`을 붙입니다.

### 1시간 인터뷰 진행 순서

| 시간 | 단계 |
|---|---|
| 0-5분 | `new-project.sh` 실행, Claude Code로 폴더 열기, `gh run watch`로 첫 배포 확인 |
| 5-10분 | 면접관과 기능 목록 합의, 첫 기능의 UX flow + 시나리오 |
| 10-50분 | 기능마다 `/feature` 한 번, 로컬에서 `npm run verify`, 기능마다 push (CI가 배포) |
| 50-60분 | 실제 앱, `/coverage/`, 로그 대시보드, Help 도우미 시연, AGENTS.md 설명 |

---

## 2. 새 Mac에서 한 번만 하는 설정

이 컴퓨터에서는 이미 끝났습니다(2026-10-12). 다른 컴퓨터에서만 반복하세요.

1. 관리자 권한 없이 `~/.local`에 설치한 도구(공식 릴리스, 체크섬 확인):
   Node.js 24.21.0, GitHub CLI 2.102.0, uv 0.13.0, wrangler 4.149.0 (`npm install -g wrangler`).
   `~/.zshrc`에 `export PATH="$HOME/.local/bin:$PATH"`가 있습니다. `jq`는 macOS에 기본으로 있습니다.
2. 로그인: `gh auth login`, `wrangler login` (이 Mac의 브라우저에서 승인).
3. GitHub Actions용 **Cloudflare API 토큰** (CI는 브라우저 로그인을 쓸 수 없습니다):
   Cloudflare 대시보드 -> My Profile -> API Tokens -> Create Token -> Custom token, 권한:
   - Account: Workers Scripts **Edit**, D1 **Edit**, Vectorize **Edit**, Workers AI **Read**, Account Settings **Read**
   - User: User Details **Read**, Memberships **Read**

   키체인에 한 번 저장합니다(토큰은 직접 입력하고, 화면에 보이거나 파일에 저장되지 않습니다):
   ```bash
   security add-generic-password -a "$USER" -s cloudflare-api-token -w
   ```
4. 이 템플릿은 GitHub 템플릿 저장소여야 합니다(`gh repo edit cd-jung/fullstack-template --template`).

---

## 3. 결정 사항 (그리고 이유)

2026-10-12 계획 세션에서 정한 내용입니다. 의도할 때만 바꾸세요. AGENTS.md 1장은 에이전트가 이것을 바꾸기 전에 묻도록 합니다.

### 호스팅과 런타임

| 결정 | 선택 | 검토한 대안 | 이유 |
|---|---|---|---|
| 클라우드 | Cloudflare (Workers, Static Assets, D1, Vectorize, Workers AI) | - | 계정 하나, 무료 한도, 서버 없음, 몇 초 만에 배포 |
| 프론트엔드 호스팅 | **Workers Static Assets** (별도 Worker, `frontend/wrangler.jsonc`) | R2 버킷 + 도메인, 구버전 Pages | 원래 Pages로 계획. 2026-10-12에 wrangler 4.149가 Pages를 "Workers에 통합된 최신 Cloudflare Pages"로 넘겨서 사용자가 Static Assets를 선택. SPA fallback, CDN, 정적 요청 무료·무제한. R2만 쓰면 규칙을 직접 만들어야 함. R2는 사용자 파일용 |
| 백엔드 | **Python Workers 위의 Django** (`django-cf`로 WSGI) | Python Workers 위의 FastAPI, Hono + Drizzle (TypeScript), **Cloudflare Containers**의 Django | Django를 의도적으로 유지. Containers는 Workers Paid(월 $5)와 Docker 필요. FastAPI는 D1 ORM이 없음. CPU 한도가 문제되면 Hono + Drizzle로 전환 |
| 컨테이너 | **사용 안 함** | Cloudflare Containers | Workers는 컨테이너가 아니라 V8 isolate에서 실행(Python은 Pyodide) |
| 요금제 | **Workers Free** | Workers Paid 월 $5 | 사용자 결정: 무료 유지. 아래 CPU 참고 |

**CPU 참고 (2026-10-12 측정):** Django + D1(1만 행) 스파이크는 무료 플랜에서 동작했습니다
(요청당 약 0.2-0.3초, 콜드 스타트 약 2초). 하지만 요청당 CPU가 **50-64ms**로 무료 한도 10ms를 넘었습니다.
트래픽이 적을 때는 Cloudflare가 허용했습니다. "exceeded CPU"로 요청이 실패하기 시작하면 Workers Paid로
올리거나 API를 Hono + Drizzle로 옮기세요.

### 데이터

| 결정 | 선택 | 이유 |
|---|---|---|
| 데이터베이스 | Django ORM으로 쓰는 **D1** (`django_cf.db.backends.d1`) | Django용 Cloudflare 공식 방식, 무료 5GB |
| 감수한 제약 | 트랜잭션 없음, SQLite 문법 | 이 범위에서는 문제없음 |
| 선택하지 않음 | Durable Objects SQLite(더 복잡), Hyperdrive + Postgres(Django `psycopg`의 Pyodide 동작 미확인) | 시간 제한이 있는 개발에서 위험 |
| 마이그레이션 | Django 마이그레이션을 `backend/d1_migrations/*.sql`로 내보내고, CD에서 `wrangler d1 migrations apply`로 적용 | D1에는 `manage.py migrate`를 돌릴 셸이 없음 |
| 서비스 데이터 | D1에만 저장 (예: 1만 건) | 서비스 데이터는 벡터 DB에 넣지 **않음** |

### AI 기능

| 결정 | 선택 | 이유 |
|---|---|---|
| LLM | Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, temperature 0 | API 키 불필요, 하루 10,000 Neurons 무료 |
| 임베딩 | Workers AI `@cf/baai/bge-m3` (1,024차원, 다국어) | 한국어와 영어 질문 |
| 벡터 DB | **Vectorize** | 네이티브 바인딩, 저장 500만 차원 무료(약 4,800개 조각) |
| RAG 원본 | **유저 가이드만** (`docs/user-guide/*.md`) | 도우미는 서비스 사용법만 안내 |
| RAG 답변 | 짧은 요약 + 해당 가이드 섹션 링크 | 전체 내용은 유저 가이드 메뉴에서 읽음 |
| 자연어 검색 | LLM -> JSON 필터 -> 허용 목록 카탈로그로 검증 -> Django ORM | `poc_samples` 자연어 검색 설계를 이식: text-to-SQL 없음, 값 바인딩, 두 번 검증 |
| PoC와 다른 점 (D1) | `SET LOCAL transaction_read_only` / `statement_timeout` 없음(Postgres 전용) | 자연어 쿼리는 구조상 읽기 전용(ORM `filter()`만 사용), 쿼리 시간은 D1이 제한 |
| 테스트 모드 | `LLM_MODE` = `real` / `stub` / `down` | CI와 E2E가 결정적이고 AI 호출이 필요 없음 |

### 로그와 모니터링

- 모든 API 요청은 **Cloudflare Workers Logs**(대시보드: Workers -> API worker -> Observability,
  또는 `backend/`에서 `npx wrangler tail`)와 D1 `RequestLog` 테이블에 남습니다.
- **Logs & Monitoring** 페이지는 이 테이블을 읽습니다: 대시보드(요청 수, 5xx 오류율, p95 지연 시간,
  4xx 수, 시간별 요청 수)와 자연어(같은 자연어 -> ORM 엔진) 또는 키워드 로그 검색.

### UI

- 모든 컴포넌트는 **MUI**. 라이트/다크 모드는 OS 설정을 따릅니다.
- 왼쪽 메뉴: **Home**(프로젝트의 주요 기능), **User Guide**, **Logs & Monitoring**, **Coverage**.
- 모든 페이지에 떠 있는 **Help** 버튼이 RAG 도우미를 엽니다.

### 방법론과 자동화

- **기능 단위**로 작업합니다. 기능마다 코드, 유닛 테스트, UX flow, E2E 시나리오, E2E 테스트, 유저 가이드를
  함께 갱신합니다([AGENTS.ko.md](AGENTS.ko.md)).
- 강제 장치: `AGENTS.md`(모든 에이전트가 읽음), `scripts/check-consistency.mjs --hook`을 실행하는
  Claude Code **Stop hook**, `/feature` 스킬, 그리고 CI에서 같은 검사를 `--strict`로 실행.
- UX flow, 시나리오 카탈로그, 커버리지 리포트는 `poc_samples` E2E PoC 형식을 따릅니다.
- 문서는 영문으로 쓰고 한국어 번역본(`*.ko.md`)을 둡니다.

### CI/CD

| 단계 | 실행 내용 |
|---|---|
| verify (모든 push와 PR) | 린트 -> 커버리지 포함 유닛 테스트 -> 정합성 검사 `--strict` -> E2E (Playwright, LLM stub) -> 사이트 빌드 |
| deploy (`main`만, verify 통과 후) | D1 마이그레이션 -> Worker 배포(`pywrangler deploy`) -> 유저 가이드 재인덱싱(바뀐 섹션만) -> 프론트엔드 배포(`wrangler deploy --config frontend/wrangler.jsonc`) -> 스모크 테스트 |

Cloudflare Git 연동 대신 Actions에서 배포합니다. 그래서 모든 검사를 통과해야만 배포됩니다.
커버리지 페이지는 배포할 때마다 다시 만들어집니다.

### 저장소

- 새 프로젝트는 `~/Dev/<name>`에 두고, GitHub 저장소는 기본으로 **private**입니다.

---

## 4. 비용 (Workers Free)

| 서비스 | 무료 한도 | 템플릿 사용량 |
|---|---|---|
| Workers | 하루 요청 10만 번, 요청당 CPU 10ms | CPU 참고 |
| D1 | 하루 읽기 500만 행, 쓰기 10만 행, 5GB | 요청당 로그 1행 |
| Vectorize | 월 조회 3,000만 차원, 저장 500만 차원 | 가이드 섹션당 약 1,024차원 |
| Workers AI | 하루 10,000 Neurons | bge-m3 100만 토큰당 약 1,075 Neurons, Llama 70B 하루 출력 약 4.8만 토큰 |
| Static Assets | 정적 요청 무료·무제한 | - |

유료 플랜이 필요하면: 월 $5 (요청 1,000만 번, CPU 3,000만 ms, D1 읽기 250억 행, Vectorize 조회 5,000만 차원 포함).

---

## 5. 로컬 개발

```bash
npm run setup      # 한 번만
npm run dev        # http://localhost:5173 (API는 :8000, SQLite, LLM stub)
npm run verify     # CI가 돌리는 것
```

`LLM_MODE=real`은 Cloudflare에서만 동작합니다(Workers AI와 Vectorize 바인딩). 로컬 stub은 카탈로그 예시와
유저 가이드 키워드 검색으로 답합니다.

## 6. 알려진 한계

- Python Workers 콜드 스타트는 약 2-3초라서, 한동안 요청이 없다가 오는 첫 요청이 느립니다.
- 요청당 CPU가 무료 한도를 넘습니다(3장 참고).
- E2E는 배포된 사이트가 아니라 로컬 스택에서 돕니다. 배포 job은 스모크 테스트를 돌립니다.
- Help 도우미는 서버에 대화 기억이 없어서, 질문마다 따로 답합니다.
- Workers에서는 보안 때문에 시계가 I/O 중에만 흘러서, 로그의 `duration_ms`는 D1 / AI 호출을 기다린 시간입니다.
  순수 CPU 작업은 0ms로 보입니다.
