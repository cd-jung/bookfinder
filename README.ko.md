# BookFinder (한국어)

> 원본은 [README.md](README.md)(영문)입니다.

**자연어로 질문**하면("2015년 이후 20달러 미만 별점 4점 이상 한국 소설") 조건에 정확히 맞는 책을 찾아 주고,
서비스 사용법은 자체 유저 가이드를 바탕으로 **Help 도우미**(RAG)가 알려 주는 도서 검색 서비스예요. 모든 것이
Cloudflare(Workers, D1, Vectorize, Workers AI) 위에서 돌고, 영어·스페인어·프랑스어·한국어를 지원해요.

| | |
|---|---|
| 서비스 | https://bookfinder.kookastudios.workers.dev |
| API 상태 | https://bookfinder-api.kookastudios.workers.dev/api/health |
| 테스트 커버리지 | https://bookfinder.kookastudios.workers.dev/coverage |
| UX flow | https://bookfinder.kookastudios.workers.dev/ux-flows/ |

> **이 저장소에서 일하는 AI 에이전트와 LLM은 무엇이든 바꾸기 전에 반드시 [AGENTS.md](AGENTS.md)를 읽어야 해요**
> (한국어: [AGENTS.ko.md](AGENTS.ko.md)). 반드시 따라야 하는 작업 프로세스예요. 기능 단위로 작업하고, 변경할 때마다
> UX flow, E2E 시나리오, E2E 테스트, 유닛 테스트, 유저 가이드(4개 언어), 검증을 함께 진행해요. Claude Code는 `CLAUDE.md`로
> 자동으로 읽고, Stop hook과 CI가 지키는지 검사해요. 결정 사항·설정·운영은 [docs/project/DECISIONS.ko.md](docs/project/DECISIONS.ko.md)에 있어요.

---

## 왜 만들었나

BookFinder는 2026-10-12에 1시간짜리 "AI로 웹앱 만들기" 라이브 인터뷰의 기준 프로젝트로 만들었어요. 명세 패키지
(`poc_samples.zip`: UX flow, E2E 시나리오 카탈로그, 자연어 검색 설계, RAG 프로토타입)를 바탕으로 했고, 세 가지를 보여 줘요.

1. **처음부터 안전하게 설계한 AI 기능.** LLM은 SQL을 쓰지 않고 답을 지어내지 않아요. 자연어는 검증된 필터가 되고,
   Help 도우미는 링크로 확인할 수 있는 문서에서만 답해요.
2. **서버리스 스택 위의 완전한 제품.** 프론트엔드, API, 데이터베이스, 벡터 검색, LLM이 모두 Cloudflare 계정 하나에서 돌고,
   테스트를 통과한 push마다 CI/CD가 배포해요.
3. **AI와 함께 일하는 개발 방법.** 기능마다 UX flow, E2E 시나리오와 테스트, 유닛 테스트, 사용자 문서가 함께 움직이고,
   에이전트가 따르고 CI가 확인하는 규칙([AGENTS.md](AGENTS.md))으로 맞춰져요. 같은 구성을 템플릿
   [cd-jung/fullstack-template](https://github.com/cd-jung/fullstack-template)에서 다시 쓸 수 있어요.

## 기능

| 기능 | 동작 방식 |
|---|---|
| 키워드·필터 검색 | 생성한 책 1만 권(결정적). 제목·저자·ISBN·출판사·설명 키워드 검색, 장르·저자·연도·언어·형식·재고·평점·가격 필터, 칩, 정렬, 페이지, 격자/목록, URL 상태 |
| 자연어 검색 (AI) | 질문 → LLM → JSON 필터 → 허용 목록으로 검증 → Django ORM 쿼리. "해석 결과"에 모든 조건을 보여 주고, "필터로 편집"으로 필터 패널에 옮겨요 |
| 책 정보 | 형식별 가격과 재고, 비슷한 책, ISBN·링크 복사, 딥 링크 |
| Help 도우미 (RAG) | "어떻게 해요?" 질문에 유저 가이드만으로, 사용자의 언어로, 정확한 섹션 링크와 함께 답해요 |
| 유저 가이드 | 4개 언어로 7페이지. 같은 Markdown 파일이 앱 안의 가이드이자 **RAG 원본**이에요 |
| 로그 및 모니터링 | 모든 API 요청을 기록. 대시보드(요청 수, 5xx 비율, p95, 4xx, 시간별)와 자연어 로그 검색 |
| 커버리지 | 유닛 테스트 커버리지, E2E 시나리오 커버리지, UX flow 그래프를 앱 안에서 보여 줘요 |
| 다국어 | English, Español, Français, 한국어로 UI 문구, 유저 가이드, Help, "해석 결과", 카탈로그 값을 제공 |

## 아키텍처

```mermaid
flowchart LR
  user(["브라우저"])
  subgraph edge["Cloudflare 엣지 (DDoS 방어, TLS)"]
    fe["프론트엔드 Worker (공개)<br/>Static Assets: React + MUI 앱<br/>도서 검색, 사용자 가이드, 커버리지, UX 흐름<br/>보안 헤더 (_headers)"]
    adm["관리자 Worker (Cloudflare Access)<br/>로그 및 모니터링<br/>Access JWT 검증, /api 프록시"]
    api["API Worker<br/>Python Workers(Pyodide) 위의 Django<br/>책, 자연어 검색, Help RAG, 로그"]
    rl["Rate Limiting 바인딩<br/>API_LIMITER 분당 120, AI_LIMITER 분당 10"]
  end
  d1[("D1 (SQLite)<br/>책, 저자, 요청 로그,<br/>가이드 조각, 피드백, AI 사용량")]
  ai["Workers AI<br/>Llama 3.3 70B (자연어 필터, 답변)<br/>bge-m3 (임베딩)"]
  vz[("Vectorize<br/>유저 가이드 임베딩<br/>(en, es, fr, ko)")]
  wl["Workers Logs<br/>(stdout, wrangler tail)"]
  gh["GitHub Actions CI/CD"]

  user -->|"페이지, 정적 파일"| fe
  user -->|"fetch /api/... ?lang="| api
  api --> rl
  api -->|"Django ORM (django-cf)"| d1
  api -->|"생성 / 임베딩"| ai
  api -->|"벡터 검색"| vz
  api --> wl
  user -->|"관리자, 이메일 로그인"| adm
  adm -->|"서비스 바인딩 + X-Admin-Proxy"| api
  api -->|"GraphQL Analytics (읽기 전용)"| wl
  gh -->|"wrangler deploy"| fe
  gh -->|"wrangler deploy"| adm
  gh -->|"pywrangler deploy"| api
  gh -->|"마이그레이션, 한 번만 시드"| d1
  gh -->|"유저 가이드 인덱싱"| vz
```

| 구성 요소 | Cloudflare 서비스 | 구현 |
|---|---|---|
| 프론트엔드 | **Workers Static Assets** | React + TypeScript + Vite, MUI 컴포넌트, react-router, react-i18next. 정적 파일만 있어서 요청이 무료이고 코드가 돌지 않아요 |
| API | **Python Workers** | `django-cf`로 Pyodide 위에서 도는 Django(WSGI). 앱: `books`(카탈로그), `nlsearch`(자연어 → 필터 → ORM), `rag`(Help), `logs`(요청 로그, 대시보드), `core`(LLM 게이트웨이, 제한, CORS) |
| 데이터베이스 | **D1** | SQLite 위의 Django ORM. 넓은 `books_book` 테이블 하나(다중 값은 `\|a\|b\|` 토큰, D1 쓰기 한도를 고려), 요청 로그, 언어별 가이드 조각 |
| LLM | **Workers AI** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 질문을 필터로 바꾸고 Help 요약을 써요. temperature 0, API 키 없이 바인딩으로 호출 |
| 임베딩 | **Workers AI** `@cf/baai/bge-m3` | 유저 가이드와 질문을 다국어 1,024차원 벡터로 |
| 벡터 DB | **Vectorize** | 4개 언어 유저 가이드 섹션 전체의 코사인 인덱스 |
| 남용 방지 | **Rate Limiting 바인딩** | DB 작업 전에 엣지에서 IP별 제한 |
| 배포 | GitHub Actions + `wrangler` | 린트 → 유닛 → 정합성 → E2E → 빌드, 그다음 D1 마이그레이션, 시드, 배포, 가이드 인덱싱, 스모크·실제 모델 테스트 |

모든 LLM·임베딩·벡터 호출은 모듈 하나(`backend/src/core/llm.py`)를 거치고, 모드는 세 가지예요: `real`(Workers AI),
`stub`(CI와 E2E용 결정적 픽스처), `down`(장애 테스트).

## 자연어 검색: 질문 → 검증된 필터 → ORM

LLM은 데이터베이스 사용자가 아니라 **작은 JSON 필터 언어로 옮기는 번역기**로만 써요. 설계는 명세의
`nl-search-implementation` 가이드에서 왔어요.

```mermaid
sequenceDiagram
  participant U as 사용자
  participant FE as 프론트엔드
  participant API as API Worker (Django)
  participant LLM as Workers AI (Llama 3.3)
  participant DB as D1

  U->>FE: "2015년 이후 20달러 미만 별점 4점 이상 한국 소설"
  FE->>API: POST /api/nl-search/translate {question, lang}
  API->>API: 제한 (IP별 엣지, 클라이언트별 분당 10회, 하루 AI 예산)
  API->>LLM: 프롬프트 = 규칙 + 허용 목록 카탈로그 + 예시 + 마커 안의 질문
  LLM-->>API: {"and":[{"field":"language","op":"eq","value":"Korean"}, ...]}
  API->>API: 검증: 아는 필드·연산자·템플릿, 타입 맞는 값, 깊이 4, 조건 15개
  API-->>FE: {filter, UI 언어로 된 설명}
  FE->>FE: "해석 결과: (언어: 한국어 그리고 장르: 문학 그리고 ...)" 표시
  FE->>API: GET /api/books?nl_filter=...&in_stock=1&lang=ko
  API->>API: 필터를 다시 검증 (URL은 신뢰하지 않음)
  API->>DB: SELECT ... WHERE <ORM 조건, 바인딩 파라미터>
  DB-->>API: 일치하는 책
  API-->>FE: 결과 한 페이지 + 패싯 개수
```

- **카탈로그가 유일한 기준** (`backend/src/books/catalog.py`): 검색 가능한 필드마다 타입, 연산자, ORM 경로, 4개 언어 라벨이
  있어요. 추가 로직이 필요한 조건은 서버 쪽 **템플릿**(수상작, 시리즈 도서, 신간, 저자 수, 비슷한 책)으로 처리해요. 프롬프트,
  검증기, "해석 결과" 문장, stub 픽스처가 모두 여기서 만들어져요.
- **안전장치:** 필드 이름과 ORM 경로는 카탈로그에서만 오고, 값은 바인딩 파라미터예요. 필터는 해석할 때 **그리고** 목록을
  요청할 때마다 검증하고, 쿼리는 SELECT만 해요. 카탈로그로 표현할 수 없는 질문은 추측 대신 "다르게 질문해 주세요"(422)로 답해요.
- **설명 가능:** "해석 결과"는 필터에서 1:1로 만들어서 사용자가 조건을 하나하나 확인할 수 있고, "필터로 편집"으로 일반 필터로 바꿀 수 있어요.

### 전체 처리 흐름 (모든 실패 경로 포함)

```mermaid
flowchart TD
  Q(["4개 언어 중 하나로 한 질문"]) --> V0{"비어 있거나<br/>500자 초과?"}
  V0 -- 예 --> E400["400: 질문 필요 / 너무 김"]
  V0 -- 아니오 --> RL{"이 클라이언트가<br/>분당 10회 초과?"}
  RL -- 예 --> E429["429 + Retry-After"]
  RL -- 아니오 --> MODE{"LLM 모드"}
  MODE -- "stub (CI, E2E)" --> FIX["카탈로그 예시의 고정 필터"]
  MODE -- "down (장애 테스트)" --> E502
  MODE -- real --> BUD{"오늘 AI 예산이<br/>남았나?"}
  BUD -- 아니오 --> E502["502: AI 서비스 사용 불가<br/>(예산 소진, 시간 초과, JSON 없음·오류)"]
  BUD -- 예 --> LLM["Workers AI, Llama 3.3 70B, temperature 0<br/>프롬프트 = 문법 + 규칙 + 카탈로그 + 예시<br/>질문은 마커 사이에 넣어 데이터로 취급"]
  LLM --> PARSE{"출력에<br/>JSON 객체가 있나?"}
  PARSE -- 아니오 --> E502
  PARSE -- 예 --> ERR{"모델이<br/>{error: ...}로 답했나?"}
  FIX --> ERR
  ERR -- 예 --> E422["422: 다시 질문해 주세요"]
  ERR -- 아니오 --> VAL{"검증기<br/>허용된 필드·연산자·템플릿<br/>값 타입, 깊이 ≤ 4, 조건 ≤ 15"}
  VAL -- 통과 못함 --> E422
  VAL -- 통과 --> DESC["describe_filter: UI 언어로<br/>'해석된 조건' 문장 생성 (필터와 1:1)"]
  DESC --> UI["화면에 해석된 조건 표시<br/>+ 필터로 편집"]
  UI --> LIST["GET /api/books?nl_filter=..."]
  LIST --> VAL2{"다시 검증<br/>(URL은 신뢰하지 않음)"}
  VAL2 -- 통과 못함 --> E400b["400: nl_filter 오류"]
  VAL2 -- 통과 --> ORM["Django Q 객체로 컴파일<br/>ORM 경로는 카탈로그에서, 값은 바인딩 파라미터"]
  ORM --> DB[("D1: SELECT만")]
  DB --> RES["책 목록 한 페이지 + 패싯 개수"]
```

### 필터 언어

모델은 아래의 작은 문법으로만 답할 수 있어요 (프롬프트에 들어 있고, 검증기가 강제합니다).

```text
node      := {"and": [node, ...]} | {"or": [node, ...]} | {"not": node} | condition | template
condition := {"field": <필드 이름>, "op": <연산자>, "value": <값>}
template  := {"template": <템플릿 이름>, "params": {...}}
```

| 필드 타입 | 허용 연산자 |
|---|---|
| string | `eq`, `icontains`, `in`, `isnull` |
| number, date | `eq`, `gt`, `gte`, `lt`, `lte`, `isnull` |
| datetime | `gt`, `gte`, `lt`, `lte`, `isnull` |
| enum | `eq`, `in` |
| boolean | `eq` |

예: *"2015년 이후 20달러 미만 별점 4점 이상 한국 소설"* (영어·스페인어·프랑스어로 물어도 같음)은 이렇게 바뀝니다.

```json
{
  "and": [
    {"field": "language",       "op": "eq",  "value": "Korean"},
    {"field": "genre",          "op": "eq",  "value": "literary-fiction"},
    {"field": "published_year", "op": "gt",  "value": 2015},
    {"field": "price",          "op": "lt",  "value": 20},
    {"field": "rating",         "op": "gte", "value": 4}
  ]
}
```

모델은 테이블 이름도 SQL도 보지 못하고, 카탈로그에서 고르기만 합니다. 모델이 지어낸 것(없는 필드, 잘못된 연산자,
숫자 자리에 문자열, 너무 깊은 중첩)은 쿼리를 만들기 전에 모두 거부됩니다.

### 카탈로그 하나가 모든 것을 만든다

```mermaid
flowchart LR
  CAT["카탈로그<br/>(books/catalog.py)<br/>필드: 타입, 연산자, ORM 경로,<br/>4개 언어 라벨<br/>템플릿, 예시, 한도"]
  CAT --> P["LLM 프롬프트<br/>(허용 목록 + 예시)"]
  CAT --> C["검증기 + 컴파일러<br/>(필터 → Django Q)"]
  CAT --> D["'해석된 조건' 문장<br/>(4개 언어)"]
  CAT --> S["Stub 고정 응답<br/>(LLM 없이 CI·E2E)"]
  CAT --> X["예시 질문 칩<br/>(GET /api/nl-search/examples)"]
  CAT2["로그 카탈로그<br/>(logs 앱)"] -. 같은 엔진 .-> C
```

검색 필드를 하나 추가하려면 카탈로그 항목 하나만 추가하면 됩니다. 프롬프트, 검증, 설명 문장, 테스트가 모두 따라옵니다.
Logs & Monitoring 페이지도 자체 카탈로그로 같은 엔진을 써서, 관리자가 요청 로그를 자연어로 검색할 수 있습니다.

### 상태 코드

| 코드 | 언제 | 사용자에게 보이는 것 |
|---|---|---|
| 200 | 유효한 필터 | 해석된 조건 + 결과 |
| 400 | 질문이 비었거나 너무 김, 또는 URL의 `nl_filter`가 잘못됨 | 입력 오류 |
| 422 | 카탈로그로 표현할 수 없는 질문, 또는 모델의 필터가 검증을 통과하지 못함 | "다시 질문해 주세요" |
| 429 | 한 클라이언트가 분당 10회 넘게 요청 | `Retry-After` 이후 다시 시도 |
| 502 | AI 서비스 장애·시간 초과, JSON 없음·오류, 또는 오늘 AI 예산 소진 | 키워드 검색은 계속 사용 가능 |

## Help 도우미: 유저 가이드 기반 RAG

도우미는 "BookFinder를 어떻게 써요?"라는 질문에만, 유저 가이드로만 답하고, 답의 출처를 항상 보여 줘요. 책 데이터는 일부러
벡터 인덱스에 넣지 **않았어요**.

```mermaid
flowchart TB
  subgraph Indexing["인덱싱 (CD, 배포할 때마다)"]
    direction LR
    md["docs/user-guide/{en,es,fr,ko}/*.md"] --> chunk["제목 기준으로 나누기<br/>(약 350토큰, 50 겹침)<br/>id = lang/page#n, anchor = 제목 slug"]
    chunk --> changed{"내용 해시가 바뀌었나?"}
    changed -->|"예"| embed["bge-m3 임베딩<br/>(Workers AI REST)"]
    embed --> vec[("Vectorize")]
    changed -->|"예"| rows[("D1 rag_guidechunk<br/>본문, 섹션, 앵커, 언어")]
    changed -->|"삭제됨"| delete["양쪽에서 삭제"]
  end

  subgraph Answering["답변 (API, 질문마다)"]
    direction LR
    q["질문 + UI 언어<br/>(+ 이전 질문)"] --> qe["bge-m3 질문 임베딩"]
    qe --> search["Vectorize 상위 20개"]
    search --> keep["UI 언어 조각 중<br/>유사도 0.5 이상만 (상위 5개)"]
    keep -->|"없음"| fixed["UI 언어의 고정 답변<br/>(LLM 호출 안 함)"]
    keep -->|"있음"| prompt["문맥 전용 프롬프트:<br/>섹션 + 마커 안의 질문 +<br/>'한국어로 답하세요' 등"]
    prompt --> llm["Llama 3.3: 2~5문장 요약"]
    llm --> clean["본문에서 URL·id 제거"]
    clean --> out["답변 + 조각으로 만든 링크:<br/>/guide/page#section"]
  end
```

- **근거 기반:** 기준을 넘는 섹션이 없으면 LLM을 부르지 않고 사용자 언어로 "사용자 가이드에서 찾지 못했어요"라고 답해요.
  링크는 모델 출력이 아니라 검색된 조각으로 서버가 만들어서, 모든 링크가 실제 섹션을 열어요.
- **다국어:** 언어마다 가이드를 따로 인덱싱하고, 검색은 UI 언어만 쓰고, 프롬프트에 답변 언어를 적어요. 그러지 않으면
  Llama가 영어 섹션을 따라 영어로 답하는데, 이 문제는 배포 후 `@real` 테스트가 찾아서 고쳤어요.
- **대화:** 후속 질문은 이전 질문과 함께 검색해요. 대화 기록은 브라우저(sessionStorage)에만 있고, 서버에는 선택적인 좋아요/싫어요 피드백만 남아요.
- **하나의 원본:** 같은 Markdown 파일이 앱 안의 유저 가이드이자 RAG 원본이고, CD가 바뀐 섹션만 다시 인덱싱해서 문서와 답변이 어긋나지 않아요.

## 안전, 비용, 보안

| 걱정 | 보호 장치 |
|---|---|
| 트래픽 폭주 / DDoS | Cloudflare 엣지 DDoS 방어, 정적 파일은 무료, IP별 엣지 제한(분당 API 120회, AI 10회)으로 D1 작업 전에 거절 |
| AI 비용 | 클라이언트별 분당 10회, **하루 AI 예산**(`AI_DAILY_LIMIT` = 하루 실제 호출 500회), 출력 토큰 상한, LLM을 부르지 않는 고정 답변 |
| 연산·저장 | 요청당 `limits.cpu_ms` 5,000, 요청 본문 64KB, 14일 지난 로그 삭제, 시드는 한 번만 |
| 프롬프트 인젝션 | 사용자 문장은 마커 안에, 문맥 전용 프롬프트, 카탈로그 허용 목록, 서버가 만드는 링크 |
| 웹 | 사이트에 CSP와 보안 헤더, API에 `nosniff`·`X-Frame-Options`, 앱 출처만 허용하는 CORS, HTML 없이 렌더링하는 Markdown |
| 관리자 페이지 | 로그와 모니터링은 **Cloudflare Access**(이메일 허용 목록) 뒤의 별도 관리자 Worker에 있고, API는 `/api/logs`를 그 Worker에만 제공(공유 시크릿, 없으면 차단). 커버리지와 UX 흐름은 공개(개인 데이터 없음) |
| 시크릿과 개인정보 | 계정 없음, 로그에는 솔트를 넣은 IP 해시만, `DJANGO_SECRET_KEY`는 CD가 설정하는 Worker 시크릿, 배포는 범위를 제한한 GitHub 시크릿 사용 |

세부 사항, 측정값, 권장 대시보드 설정(결제 알림, 관리자 사이트용 Cloudflare Access, GitHub secret scanning)은
[docs/project/DECISIONS.ko.md](docs/project/DECISIONS.ko.md#비용-안전장치와-보안)에 있어요.

## 품질: 기능을 만들고 확인하는 방법

```mermaid
flowchart LR
  flow["UX flow<br/>ux-flows/*.md"] --> scen["E2E 시나리오<br/>e2e/scenarios/catalog.json"]
  scen --> code["코드 + 유닛 테스트<br/>(pytest, Vitest)"]
  code --> e2e["E2E 테스트<br/>Playwright, [ID] 태그"]
  e2e --> guide["유저 가이드<br/>4개 언어"]
  guide --> verify["npm run verify<br/>+ Stop hook + CI --strict"]
  verify --> deploy["CD 배포 +<br/>실제 사이트 @real 확인"]
```

E2E 시나리오 121개(core 46개)가 모두 테스트로 덮여 있고, push마다 백엔드 유닛 테스트 135개와 프론트엔드 80개가 돌아요.
커버리지 페이지는 시나리오마다 그 시나리오가 확인하는 UX flow 노드를 연결해 보여 줘요.

## 로컬에서 실행하기

```bash
npm run setup
```

```bash
npm run dev
```

http://localhost:5173에서 열리고, API는 :8000에서 돌아요(SQLite, 시드된 책 1만 권, LLM stub). `npm run verify`는 CI가
돌리는 것을 모두 실행해요. 요구 사항과 Cloudflare·GitHub 최초 설정은 [docs/project/DECISIONS.ko.md](docs/project/DECISIONS.ko.md)에 있어요.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| [AGENTS.md](AGENTS.md) | **에이전트와 개발자가 반드시 따르는 작업 프로세스** (한국어: AGENTS.ko.md) |
| `backend/` | Python Workers 위의 Django API, 테스트, D1 마이그레이션, CD 스크립트 |
| `frontend/` | React + MUI 앱, 다국어 사전, 유닛 테스트 |
| `docs/user-guide/<lang>/` | 유저 가이드 페이지 = RAG 원본 |
| `ux-flows/` | Mermaid UX flow와 뷰어 |
| `e2e/` | 시나리오 카탈로그, Playwright 테스트, 커버리지 리포트 |
| `docs/project/` | 결정 사항, 설정, 운영, 비용 |
| `.github/workflows/ci.yml` | CI/CD |
