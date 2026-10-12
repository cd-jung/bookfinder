# 8. App Shell & Navigation

Every page shares the header (BookFinder; clicking it opens a clean search), the left menu and the
floating Help button. The public site serves Book Search and the User Guide; Logs & Monitoring and
Coverage are on the admin site, so on the public site those entries open the admin site.

```mermaid
flowchart TD
  open(["Open any URL"]) --> shell["Header 'BookFinder',<br/>left menu, Help button"]
  shell --> viewport{"Viewport"}
  viewport -->|"desktop"| permanent["Menu always visible on the left"]
  viewport -->|"mobile"| drawer["Menu button opens a drawer"]
  shell --> menu["Menu: Book Search, User Guide,<br/>Logs & Monitoring, Coverage"]
  menu -->|"Book Search"| home[["Book search<br/>(scenarios 1-4)"]]
  menu -->|"User Guide"| guide[["User Guide<br/>(scenario 9)"]]
  menu -->|"Logs & Monitoring / Coverage<br/>on the public site"| adminLink["Opens the admin site<br/>(sign-in with Cloudflare Access)"]
  adminLink --> logs
  menu -->|"Logs & Monitoring"| logs[["Logs & Monitoring<br/>(scenario 10)"]]
  menu -->|"Coverage"| coverage["Coverage report inside the layout<br/>(build hint when not built yet)"]
  shell -->|"Help"| help[["Help assistant<br/>(scenario 5)"]]
  shell -->|"Display language"| languages[["Language select<br/>(scenario 11)"]]
  open -->|"unknown path"| notFound["'Page not found' + Go to Home"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  class shell,permanent,drawer,menu,coverage,adminLink screen
  class notFound hidden
  class home,guide,logs,help,languages link

  %% link home 01-page-load-layout.md
  %% link guide 09-user-guide.md
  %% link logs 10-logs-monitoring.md
  %% link help 05-help-conversation.md
  %% link languages 11-languages.md
  %% guide 01-getting-started.md
```
