# 1. Page Load & Layout

BookFinder is a fictional book search service. No login. The search is the Book Search page (`/`)
inside the app shell (scenario 8).
URL query keeps the state: `mode`, `q`, filters, `sort`, `page`, `book`.

```mermaid
flowchart TD
  open(["Open / (optionally with query string)"]) --> load["Load catalogue facets<br/>(genres, languages, formats,<br/>year and price ranges)"]
  load -->|"ok"| layout["Layout: header, search panel,<br/>filter panel, results area,<br/>'Help' button"]
  load -->|"API error"| loadErr[["Error banner with Retry<br/>(scenario 7)"]]

  layout --> header["Header: BookFinder logo<br/>(click resets to a clean '/')"]
  layout --> modeTabs{"Search mode tab"}
  modeTabs -->|"Keyword & filters (default)"| keyword[["Keyword & filter search<br/>(scenario 2)"]]
  modeTabs -->|"Ask in plain language (AI)"| nl[["Natural language search<br/>(scenario 4)"]]
  layout --> initial["Initial results: popular books<br/>sorted by Relevance, page 1"]
  initial --> results[["Results & book detail<br/>(scenario 3)"]]
  layout --> chatBtn["Floating 'Help' button"]
  chatBtn --> chat[["Help assistant<br/>(scenarios 5-6)"]]

  open --> restore{"Query string present?"}
  restore -->|"mode=nl&q=..."| nl
  restore -->|"q / filters / sort / page"| keyword
  restore -->|"book=id"| results
  restore -->|"invalid values"| sanitize["Unknown params ignored,<br/>invalid values fall back to defaults"]

  layout --> viewport{"Viewport"}
  viewport -->|"desktop"| desktop["Filter panel on the left"]
  viewport -->|"mobile"| mobile["'Filters' button opens a drawer;<br/>Help opens full screen"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class layout,initial,chatBtn,desktop,mobile screen
  class sanitize hidden
  class keyword,nl,results,chat,loadErr link
  class load internal

  %% link keyword 02-keyword-filter-search.md
  %% link nl 04-natural-language-search.md
  %% link results 03-results-book-detail.md
  %% link chat 05-help-conversation.md
  %% link loadErr 07-common-states-accessibility.md

  %% guide 01-getting-started.md
```
