# 3. Help Assistant (RAG)

Answers how to use the app from the User Guide only: the question is embedded, similar guide
sections are retrieved from Vectorize, and the LLM writes a short summary. Links to the sections
come from the server, not from the model.

```mermaid
flowchart TD
  btn(["Click 'Help'"]) --> panel["Chat panel, disclaimer,<br/>focus in the input"]
  panel --> input["Question box (max 1000 chars,<br/>counter near the limit)"]
  input -->|"Enter"| send["Send"]
  input -->|"Shift+Enter"| newline["New line"]
  input -->|"blank"| disabled["Send disabled"]
  send --> retrieve["Retrieve guide sections<br/>above the similarity threshold"]
  retrieve -->|"found"| summary["Short summary answer"]
  summary --> links["Source links to the guide sections"]
  links -->|"click"| guide[["User Guide section<br/>(scenario 2)"]]
  retrieve -->|"nothing relevant"| noContext["'I couldn't find that in the User Guide'<br/>(LLM not called)"]
  send -->|"AI unavailable"| error["Error message + Retry"]
  error -->|"Retry"| send
  panel --> close["Close: conversation kept"]
  close -->|"reopen / reload"| panel
  panel --> clear["New conversation clears history"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class panel,input,summary,links screen
  class disabled,noContext,error hidden
  class guide link
  class retrieve internal

  %% link guide 02-user-guide.md

  %% guide 02-help-assistant.md
```
