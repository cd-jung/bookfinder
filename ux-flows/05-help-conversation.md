# 5. Help Assistant - Conversation

The Help assistant explains how to use BookFinder. Each question is embedded, the most similar User Guide
sections are retrieved from Vectorize, and the LLM writes a short summary from those sections only, with
links to them. It does not answer questions about individual books (that is what the search is for).
Grounding and safety rules are in scenario 6. Adapted from the original "Ask the librarian" catalogue chatbot.

```mermaid
flowchart TD
  btn(["Click 'Help'"]) --> panel["Chat panel (bottom right;<br/>full screen on mobile), focus in input"]
  panel --> welcome["Welcome message + disclaimer<br/>'Answers ... may be inaccurate'"]
  panel --> suggested["Suggested questions chips"]
  suggested -->|"click"| send
  panel --> input["Message box (max 1000 chars,<br/>counter near limit)"]
  input -->|"Enter"| send["Send"]
  input -->|"Shift+Enter"| newline["New line"]
  input -->|"blank"| sendDisabled["Send disabled"]

  send --> userMsg["User message bubble"]
  userMsg --> retrieve["Retrieve User Guide sections<br/>above the similarity threshold"]
  retrieve --> generate["LLM summarises those sections"]
  generate --> waiting["'Looking it up...' (aria-live polite)"]
  waiting --> stop["'Stop generating' button"]
  stop --> partial["Request cancelled,<br/>answer marked 'Stopped.'"]
  waiting --> answer["Short answer"]
  answer --> sources["Links to the User Guide sections used"]
  sources -->|"click"| guide[["User Guide section<br/>(scenario 9)"]]
  answer --> copy["Copy answer"]
  answer --> feedback["Thumbs up / down"]
  feedback -->|"down"| comment["Optional comment, Submit"]
  feedback --> thanks["'Thanks for the feedback'"]

  answer --> followUp["Follow-up question is searched<br/>together with the previous question"]
  followUp --> send

  emptyRes(["'Get help' from empty results"]) --> prefill["Input prefilled with a search-tips question"]
  prefill --> send

  panel --> newChat["'New conversation': confirm,<br/>history cleared"]
  panel --> close["Close: conversation kept"]
  close -->|"reopen"| panel
  panel --> persist["Conversation kept in sessionStorage<br/>across reloads (same tab)"]

  generate -->|"error"| err["Error message + Retry"]
  err -->|"Retry"| send
  generate -->|"over 30s"| timeout["Timeout message + Retry"]
  send -->|"429"| rate["'Too many questions,<br/>please wait N seconds'"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class panel,welcome,suggested,input,userMsg,waiting,answer,sources screen
  class sendDisabled,err,timeout,rate,partial hidden
  class guide link
  class retrieve,generate,persist internal

  %% link guide 09-user-guide.md
  %% guide 05-help-assistant.md
```
