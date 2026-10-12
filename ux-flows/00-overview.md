# 0. Overview - Scenario Map

BookFinder (fictional): book search with keyword & filter search, natural language (AI) search, a Help
assistant that explains how to use the service (RAG over the User Guide), the User Guide itself and
Logs & Monitoring. No login. Click a box to open its flow.

```mermaid
flowchart LR
  s1["1 Page Load & Layout"]
  s2["2 Keyword & Filter Search"]
  s3["3 Results & Book Detail"]
  s4["4 Natural Language Search (AI)"]
  s5["5 Help Assistant - Conversation"]
  s6["6 Help Assistant - Grounding & Safety"]
  s7["7 Common States & Accessibility"]
  s8["8 App Shell & Navigation"]
  s9["9 User Guide"]
  s10["10 Logs & Monitoring"]

  s8 -->|"Book Search"| s1
  s1 -->|"Keyword tab"| s2
  s1 -->|"AI tab"| s4
  s1 -->|"Help"| s5
  s2 -->|"results"| s3
  s4 -->|"results"| s3
  s4 -->|"Edit as filters"| s2
  s2 -->|"empty results: Get help"| s5
  s5 -->|"source link"| s9
  s5 --- s6
  s8 -->|"User Guide"| s9
  s8 -->|"Logs & Monitoring"| s10
  s7 -.- s1

  classDef scenario fill:#e8f0fe,stroke:#2f5d9e,stroke-width:2px
  class s1,s2,s3,s4,s5,s6,s7,s8,s9,s10 scenario

  %% link s1 01-page-load-layout.md
  %% link s2 02-keyword-filter-search.md
  %% link s3 03-results-book-detail.md
  %% link s4 04-natural-language-search.md
  %% link s5 05-help-conversation.md
  %% link s6 06-help-grounding-safety.md
  %% link s7 07-common-states-accessibility.md
  %% link s8 08-app-shell.md
  %% link s9 09-user-guide.md
  %% link s10 10-logs-monitoring.md
```
