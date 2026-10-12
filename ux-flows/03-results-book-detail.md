# 3. Results & Book Detail

Results are shared by keyword, filter and natural language search. The Help assistant only explains how
to use the service, so the original "Ask about this book" action is not part of BookFinder.

```mermaid
flowchart TD
  res(["Results area"]) --> count["'N books found'<br/>(announced via aria-live)"]
  res --> sort["Sort: Relevance, Newest, Oldest,<br/>Title A-Z, Highest rated, Price low-high"]
  sort --> refetch["Refetch, page 1, URL sort=..."]
  res --> view["View toggle: Grid / List<br/>(remembered in localStorage)"]
  res --> cards["Book cards: cover, title, author, year,<br/>rating, price, availability badge"]
  cards --> noCover["Missing cover -> placeholder image"]
  res --> paging["Pagination: 20 per page,<br/>Previous / Next / page numbers"]
  paging --> refetch
  paging --> outOfRange{"page beyond last?"}
  outOfRange -->|"yes"| lastPage["Last valid page shown"]

  cards -->|"click card or title"| detail["Book detail dialog<br/>URL book=id"]
  detail --> dInfo["Cover, title, authors, description,<br/>ISBN (copy), pages, publisher,<br/>language, formats with prices, rating"]
  detail --> dStock{"Availability"}
  dStock -->|"in stock"| inStock["'In stock' badge per format"]
  dStock -->|"out of stock"| outStock["'Out of stock' + expected date if known"]
  detail --> dSimilar["'Similar books' carousel"]
  dSimilar -->|"click"| detail
  detail --> dAuthor["Click author -> keyword search<br/>by that author, dialog closes"]
  detail --> dShare["'Copy link' -> URL with book=id"]
  detail --> dClose["Close: X, Esc or backdrop;<br/>focus returns to the card"]
  dClose --> res

  deep(["Open /?book=id"]) --> found{"Book exists?"}
  found -->|"yes"| detail
  found -->|"no"| notFound["'Book not found' message,<br/>results still usable"]

  classDef screen fill:#e8f0fe,stroke:#2f5d9e
  classDef hidden fill:#fdecea,stroke:#c62828,stroke-dasharray:4 3,color:#b71c1c
  classDef link fill:#e6f4ea,stroke:#2e7d32
  classDef internal fill:#f0f0f0,stroke:#cfcfcf,color:#555555
  class count,cards,detail,dInfo,dSimilar screen
  class notFound,outStock hidden
  class refetch internal

  %% guide 03-results-and-book-details.md
```
