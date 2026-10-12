# 0. Overview - Scenario Map

Template app: left menu with the project's main feature (Home), the User Guide, a Help assistant
that answers from the User Guide (RAG), and Logs & Monitoring with natural language log search.
Click a box to open its flow.

```mermaid
flowchart LR
  s1["1 App Shell & Navigation"]
  s2["2 User Guide"]
  s3["3 Help Assistant (RAG)"]
  s4["4 Logs & Monitoring"]

  s1 -->|"User Guide menu"| s2
  s1 -->|"Help button"| s3
  s1 -->|"Logs menu"| s4
  s3 -->|"source link"| s2

  classDef scenario fill:#e8f0fe,stroke:#2f5d9e,stroke-width:2px
  class s1,s2,s3,s4 scenario

  %% link s1 01-app-shell.md
  %% link s2 02-user-guide.md
  %% link s3 03-help-assistant.md
  %% link s4 04-logs-monitoring.md
```
