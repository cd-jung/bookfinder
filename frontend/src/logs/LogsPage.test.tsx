import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/client';
import { renderAt } from '../test/render';
import type { LogsApi, LogStats } from './api';
import LogsPage from './LogsPage';
import RequestsChart from './RequestsChart';

const row = (id: number, statusCode = 200) => ({
  id,
  createdAt: '2026-10-12T01:00:00Z',
  requestId: `r${id}`,
  method: 'GET',
  path: `/api/item/${id}`,
  statusCode,
  durationMs: 12,
  level: statusCode >= 500 ? ('ERROR' as const) : ('INFO' as const),
  message: '',
  country: 'AU',
});

const stats: LogStats = {
  hours: 24,
  total: 120,
  serverErrors: 3,
  clientErrors: 4,
  errorRate: 2.5,
  p50Ms: 20,
  p95Ms: 180,
  topPaths: [],
  perHour: [
    { hour: '2026-10-12T00:00:00+00:00', requests: 70, errors: 1 },
    { hour: '2026-10-12T01:00:00+00:00', requests: 50, errors: 2 },
  ],
};

function makeApi(overrides: Partial<LogsApi> = {}): LogsApi {
  return {
    stats: vi.fn().mockResolvedValue(stats),
    list: vi.fn().mockResolvedValue({ total: 2, page: 1, pages: 1, results: [row(1), row(2, 503)] }),
    translate: vi.fn().mockResolvedValue({ filter: { field: 'status_code', op: 'gte', value: 500 }, description: 'status at least 500' }),
    examples: vi.fn().mockResolvedValue({ examples: ['errors in the last hour', 'slow requests over 500ms'] }),
    ...overrides,
  };
}

describe('LogsPage', () => {
  it('shows dashboard cards, chart and log rows', async () => {
    renderAt(<LogsPage api={makeApi()} />);
    expect(await screen.findByTestId('stat-requests')).toHaveTextContent('120');
    expect(screen.getByTestId('stat-error-rate')).toHaveTextContent('2.5%');
    expect(screen.getByTestId('stat-p95')).toHaveTextContent('180 ms');
    expect(await screen.findAllByTestId('log-row')).toHaveLength(2);
    expect(screen.getByRole('table', { name: 'Request logs' })).toBeInTheDocument();
  });

  it('translates a question, shows Interpreted as and filters the list', async () => {
    const api = makeApi();
    renderAt(<LogsPage api={api} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search logs in plain language' }), 'server errors{Enter}');
    expect(await screen.findByRole('status')).toHaveTextContent('Interpreted as: status at least 500');
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ nlFilter: { field: 'status_code', op: 'gte', value: 500 }, page: 1 }));
  });

  it('example chips run their question', async () => {
    const api = makeApi();
    renderAt(<LogsPage api={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'errors in the last hour' }));
    expect(api.translate).toHaveBeenCalledWith('errors in the last hour');
  });

  it.each([
    [422, 'The question could not be translated. Please rephrase it.'],
    [502, 'The AI search is unavailable. Use keyword search instead.'],
    [400, 'question is too long'],
  ])('maps translate error %i to a message', async (status, message) => {
    const api = makeApi({ translate: vi.fn().mockRejectedValue(new ApiError(status, { detail: 'question is too long' })) });
    renderAt(<LogsPage api={api} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search logs in plain language' }), 'x{Enter}');
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('keyword mode drops the AI filter and searches by keyword and level', async () => {
    const api = makeApi();
    renderAt(<LogsPage api={api} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search logs in plain language' }), 'server errors{Enter}');
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('tab', { name: 'Keyword' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search logs by keyword' }), 'item/1{Enter}');
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: 'item/1', level: '', page: 1 }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Level' }));
    await userEvent.click(screen.getByRole('option', { name: 'ERROR' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: 'item/1', level: 'ERROR', page: 1 }));
  });

  it('changes the dashboard time range', async () => {
    const api = makeApi();
    renderAt(<LogsPage api={api} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Time range' }));
    await userEvent.click(screen.getByRole('option', { name: 'Last 7 d' }));
    await waitFor(() => expect(api.stats).toHaveBeenLastCalledWith(168));
  });

  it('shows an empty table message and dashboard errors with Retry', async () => {
    const api = makeApi({
      list: vi.fn().mockResolvedValue({ total: 0, page: 1, pages: 1, results: [] }),
      stats: vi.fn().mockRejectedValueOnce(new ApiError(500, { detail: 'Server error' })).mockResolvedValue(stats),
    });
    renderAt(<LogsPage api={api} />);
    expect(await screen.findByText('No log entries match.')).toBeInTheDocument();
    expect(await screen.findByText('Server error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('stat-requests')).toBeInTheDocument();
  });

  it('paginates', async () => {
    const api = makeApi({ list: vi.fn().mockResolvedValue({ total: 120, page: 1, pages: 3, results: [row(1)] }) });
    renderAt(<LogsPage api={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ nlFilter: undefined, page: 2 }));
  });
});

describe('RequestsChart', () => {
  it('renders a legend, an accessible table and a hover tooltip', async () => {
    const { container } = renderAt(<RequestsChart data={stats.perHour} />);
    expect(screen.getAllByText('Server errors (5xx)').length).toBeGreaterThan(0);
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(3);
    const hitAreas = container.querySelectorAll('rect[fill="transparent"]');
    await userEvent.hover(hitAreas[1]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('50 requests');
    await userEvent.unhover(hitAreas[1]);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('says when there is no data', () => {
    renderAt(<RequestsChart data={[]} />);
    expect(screen.getByText('No requests in this time range.')).toBeInTheDocument();
  });
});
