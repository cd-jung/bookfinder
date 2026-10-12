import { getJson, postJson } from '../api/client';

export interface LogRow {
  id: number;
  createdAt: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  country: string;
}

export interface LogPage {
  total: number;
  page: number;
  pages: number;
  results: LogRow[];
}

export interface HourSlot {
  hour: string;
  requests: number;
  errors: number;
}

export interface LogStats {
  hours: number;
  total: number;
  serverErrors: number;
  clientErrors: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  topPaths: { path: string; count: number }[];
  perHour: HourSlot[];
}

export interface Translation {
  filter: unknown;
  description: string;
}

export interface LogQuery {
  nlFilter?: unknown;
  q?: string;
  level?: string;
  page?: number;
}

export const logsApi = {
  list: ({ nlFilter, q, level, page }: LogQuery) =>
    getJson<LogPage>('/api/logs/', {
      nl_filter: nlFilter ? JSON.stringify(nlFilter) : undefined,
      q,
      level,
      page,
    }),
  stats: (hours: number) => getJson<LogStats>('/api/logs/stats', { hours }),
  translate: (question: string) => postJson<Translation>('/api/logs/nl-search/translate', { question }),
  examples: () => getJson<{ examples: string[] }>('/api/logs/nl-search/examples'),
};

export type LogsApi = typeof logsApi;
