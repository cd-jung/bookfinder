# Logs & Monitoring

The **Logs & Monitoring** page shows the health of the service and lets you search request logs.

## Dashboard

The cards at the top show the last 24 hours:

- **Requests**: number of API requests.
- **Error rate**: share of requests that failed with a server error (5xx).
- **p95 latency**: 95% of requests were faster than this.
- **Client errors**: requests rejected as invalid (4xx).

The chart shows requests and server errors per hour. Change the time range with the range selector.

## Searching logs in plain language

1. Type a question such as `errors in the last hour` or `slow requests over 500ms`.
2. Press **Enter**. The search shows how it understood the question under **Interpreted as**.
3. The table lists the matching requests, newest first.

Only log fields can be searched: time, method, path, status, duration, level, message and country.
If the question cannot be turned into a log search, you are asked to rephrase it.

## Keyword search

Switch to **Keyword** to search the path and message text, optionally limited to one level.
