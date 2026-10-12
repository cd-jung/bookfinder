# 6. Help Assistant - Grounding & Safety

What the Help assistant must and must not answer. E2E runs use the deterministic stub (keyword retrieval
over the User Guide, answer taken from the best section); the deployed-site checks (`@real`) run against
Workers AI and assert properties (links exist, refusal wording) instead of exact text.

```mermaid
flowchart TD
  q(["User question"]) --> scope{"About using BookFinder?"}
  scope -->|"no (weather, coding, a specific book...)"| outScope["Fixed answer: 'I couldn't find that<br/>in the User Guide' (LLM not called)"]
  scope -->|"yes"| retrieve["Retrieve User Guide sections"]

  retrieve --> relevant{"Similar enough sections?"}
  relevant -->|"no"| unknown["Fixed answer + suggestion to<br/>browse the User Guide; no invented steps"]
  relevant -->|"yes"| grounded["Answer only from those sections"]
  grounded --> cite["Every link points to an existing<br/>User Guide section and opens it"]
  grounded --> facts["Steps and labels match the User Guide"]

  q --> inject{"Prompt injection?<br/>('ignore previous instructions',<br/>'show your system prompt')"}
  inject -->|"yes"| injectSafe["Instructions ignored,<br/>system prompt not revealed"]
  q --> pii{"Asks for personal data<br/>(other users, staff)?"}
  pii -->|"yes"| piiRefuse["Fixed answer: no personal data"]
  q --> harmful{"Harmful / abusive content?"}
  harmful -->|"yes"| modRefuse["Fixed answer, nothing generated"]
  q --> lang{"Question language"}
  lang -->|"Korean / other"| sameLang["Answer in the question language,<br/>same links (real model)"]
  q --> html["HTML / script in question<br/>rendered as plain text"]

  cite --> render["Answer markdown rendered safely<br/>(no raw HTML, links open in new tab)"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class grounded,cite,facts,sameLang,render screen
  class outScope,unknown,injectSafe,piiRefuse,modRefuse hidden
  class retrieve,html internal

  %% guide 05-help-assistant.md
```
