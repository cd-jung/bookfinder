# 4. Natural Language Search (AI)

Same design as the MEDS natural language PoC (`poc/nl-asset-search`): the question is sent to a
translate endpoint, an LLM turns it into a JSON filter, the backend validates it against an allow-list
catalogue and returns the filter plus a human-readable description. The results list then runs with
that filter (SELECT-only ORM query; on D1 there is no Postgres read-only transaction or statement timeout). The LLM never writes SQL and never sees book data.

```mermaid
flowchart TD
  tab(["'Ask in plain language (AI)' tab"]) --> box["Question box (max 500 chars)<br/>placeholder: 'e.g. Korean novels after 2015<br/>under $20 with 4+ stars'"]
  tab --> examples["Example question chips"]
  examples -->|"click"| box
  box -->|"Enter or sparkle button"| empty{"Question blank?"}
  empty -->|"yes"| ignore["Nothing sent"]
  empty -->|"no"| translating["Translating... spinner,<br/>input and button disabled"]

  translating --> api["POST /api/nl-search/translate"]
  api --> llm["LLM -> JSON filter<br/>and / or / not, field-op-value, templates"]
  llm --> validate{"Backend validation"}
  validate -->|"unknown field / operator"| invalid
  validate -->|"depth over 4 or<br/>more than 15 conditions"| invalid["422: 'The question could not be<br/>translated. Please rephrase it.'"]
  validate -->|"ok"| ok["200: filter + description"]
  api -->|"LLM unreachable / timeout"| down["502: 'The AI search is unavailable.<br/>Use keyword search instead.'"]
  api -->|"over 500 chars (API)"| tooLong["400: question is too long"]
  api -->|"over 10 per minute"| rateLimit["429: 'Too many questions,<br/>please wait N seconds'"]

  ok --> interpreted["Info: 'Interpreted as: Korean novels,<br/>published after 2015, price under $20,<br/>rating 4 or more'"]
  ok --> nlResults["Results with nl_filter<br/>(keyword q cleared, URL mode=nl&q=...)"]
  nlResults --> combine["Filter panel still applies<br/>on top of the AI filter"]
  nlResults --> results[["Results & detail<br/>(scenario 3)"]]
  nlResults --> noMatch{"0 results?"}
  noMatch -->|"yes"| nlEmpty["Empty state + 'Try keyword search'"]
  interpreted --> showFilters["'Edit as filters': copies the<br/>supported conditions into the<br/>filter panel and switches tab"]
  showFilters --> keyword[["Keyword & filters<br/>(scenario 2)"]]

  nlResults --> guard["Query guard rails: filter re-validated,<br/>SELECT-only ORM query"]
  guard -->|"timeout"| slow["'Search took too long,<br/>try a narrower question'"]

  tab -->|"switch back to Keyword tab"| resetMode["AI filter dropped,<br/>keyword results shown"]
  resetMode --> keyword

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class box,examples,interpreted,nlResults,nlEmpty screen
  class ignore,invalid,down,tooLong,slow,rateLimit hidden
  class results,keyword link
  class translating,api,llm,validate,ok,guard internal

  %% link results 03-results-book-detail.md
  %% link keyword 02-keyword-filter-search.md

  %% guide 04-ai-search.md
```
