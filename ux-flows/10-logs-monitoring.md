# 10. Logs & Monitoring

Every API request is logged to the `RequestLog` table (and Cloudflare Workers Logs). The page shows a
dashboard and searches the table in plain language: the LLM turns the question into a JSON filter,
the backend validates it against the log catalogue and runs it through the Django ORM.

```mermaid
flowchart TD
  enter(["Logs & Monitoring menu"]) --> dashboard["Dashboard cards: requests, error rate,<br/>p95 latency, client errors"]
  dashboard --> chart["Requests per hour chart<br/>(hover tooltip)"]
  dashboard --> range["Time range select"]
  range --> dashboard
  dashboard -->|"API error"| dashError["Error message + Retry"]
  enter --> nlTab["'Ask in plain language (AI)' tab"]
  nlTab --> question["Question box + example chips"]
  question -->|"Enter"| translate["POST /api/logs/nl-search/translate"]
  translate -->|"valid filter"| interpreted["'Interpreted as: ...'"]
  interpreted --> table["Log table, newest first, paginated"]
  translate -->|"422"| rephrase["'Please rephrase it.'"]
  translate -->|"LLM down"| unavailable["'The AI search is unavailable.'"]
  enter --> kwTab["'Keyword' tab"]
  kwTab --> keyword["Keyword + level filter"]
  keyword --> table
  table --> empty["'No log entries match.'"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class dashboard,chart,question,interpreted,table,keyword screen
  class dashError,rephrase,unavailable,empty hidden
  class translate internal

  %% guide 06-logs-and-monitoring.md
```
