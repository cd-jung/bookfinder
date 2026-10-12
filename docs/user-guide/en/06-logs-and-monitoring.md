# Logs & Monitoring

The **Logs & Monitoring** page shows the health of the service and lets you search request logs.

> **Administrators only.** This page is on the admin site. Sign in with an approved email address; a one-time code is sent to that address. Without signing in you see **Sign-in required**.

## Dashboard

The cards at the top show the last 24 hours:

- **Requests**: number of API requests.
- **Error rate**: share of requests that failed with a server error (5xx).
- **p95 latency**: 95% of requests were faster than this.
- **Client errors**: requests rejected as invalid (4xx).

The chart shows requests and server errors per hour. Change the time range with the range selector.

## Resource headroom

Each gauge shows how much of a limit is in use, as a percentage with a colour and a label:
**OK** (green, under 60%), **Watch** (amber, 60–85%) and **Critical** (red, 85% or more).

- **App (last 24 hours)**: response time p95 against a 1 s target, the 5xx error budget, today's AI calls against the daily AI budget, the share of rate-limited requests (429) and the vector storage in use.
- **Cloudflare**: CPU time p99 against the per-request limit, requests this month, D1 storage and D1 rows read and written this month against the included amounts. If these metrics are not set up, a note says so.

## Searching logs in plain language

1. Type a question such as `errors in the last hour` or `slow requests over 500ms`.
2. Press **Enter**. The search shows how it understood the question under **Interpreted as**.
3. The table lists the matching requests, newest first.

Only log fields can be searched: time, method, path, status, duration, level, message and country.
If the question cannot be turned into a log search, you are asked to rephrase it.

## Keyword search

Switch to **Keyword** to search the path and message text, optionally limited to one level.
