# 2. Keyword & Filter Search

Keyword box searches title, author, ISBN, publisher and description. Filters combine with AND
(values inside one multi-select filter combine with OR). Every change refetches and updates the URL.

```mermaid
flowchart TD
  start(["Keyword & filters tab"]) --> kw["Keyword box<br/>(title, author, ISBN, publisher, description)"]
  kw -->|"Enter or search icon"| run["Search: page reset to 1,<br/>URL updated (q=...)"]
  kw -->|"clear (x)"| run
  kw --> isbn{"Looks like an ISBN?"}
  isbn -->|"yes"| exact["Exact ISBN match first<br/>(hyphens ignored)"]

  start --> panel["Filter panel"]
  panel --> fGenre["Genre: multi-select checkboxes<br/>with counts"]
  panel --> fAuthor["Author: autocomplete (min 2 chars)"]
  panel --> fYear["Publication year: from / to"]
  panel --> fLang["Language: select"]
  panel --> fFormat["Format: Hardcover, Paperback,<br/>eBook, Audiobook"]
  panel --> fStock["'In stock only' toggle"]
  panel --> fRating["Minimum rating: 1-5 stars"]
  panel --> fPrice["Price range slider"]
  fGenre --> run
  fAuthor --> run
  fYear --> yearCheck{"from greater than to?"}
  yearCheck -->|"yes"| yearErr["Inline error,<br/>filter not applied"]
  yearCheck -->|"no"| run
  fLang --> run
  fFormat --> run
  fStock --> run
  fRating --> run
  fPrice --> run

  run --> chips["Active filter chips above results"]
  chips -->|"remove a chip"| run
  chips -->|"'Clear all'"| reset["All filters and keyword cleared"]
  reset --> run
  run --> counts["Facet counts update to<br/>reflect current results"]
  run --> zero{"Any results?"}
  zero -->|"no"| empty["Empty state: 'No books match',<br/>'Remove last filter' and<br/>'Get help' shortcuts"]
  zero -->|"yes"| results[["Results list<br/>(scenario 3)"]]
  empty -->|"Get help"| chat[["Help prefilled with a<br/>search-tips question (scenario 5)"]]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class kw,panel,chips,empty screen
  class yearErr hidden
  class results,chat link
  class run,counts internal

  %% link results 03-results-book-detail.md
  %% link chat 05-help-conversation.md

  %% guide 02-searching-books.md
```
