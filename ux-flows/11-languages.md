# 11. Languages

The whole app (menus, pages, User Guide, Help assistant, natural language descriptions, catalogue values
such as genres and formats, generated book descriptions) is available in English, Spanish, French and
Korean. Book titles and author names stay as published; developer reports (coverage report, UX flows)
stay in English.

```mermaid
flowchart TD
  first(["First visit"]) --> fallback{"Saved choice?"}
  fallback -->|"no"| browser["Browser language if supported,<br/>otherwise English"]
  fallback -->|"yes"| saved["Saved language"]
  browser --> shell
  saved --> shell
  shell(["Any page"]) --> picker["'Display language' select (top right):<br/>English, Español, Français, 한국어"]
  picker -->|"choose"| switch["Menus, buttons, messages and<br/>page text switch immediately"]
  switch --> remember["Choice saved on this device,<br/>restored after reload"]
  switch --> guide["User Guide shows the page<br/>in that language"]
  switch --> help["Help answers in that language<br/>from that language's User Guide, with links"]
  switch --> nl["'Interpreted as' and example<br/>questions in that language"]
  switch --> values["Genres, formats, languages and book<br/>descriptions translated; titles unchanged"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class picker,switch,guide,help,nl,values screen
  class browser,saved,remember internal

  %% guide 01-getting-started.md
```
