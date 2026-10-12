import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { HourSlot } from './api';

/**
 * Requests per hour as stacked bars: successful/other requests (series slot 1, blue) under
 * server errors (status "critical" red). One y-axis, 2px surface gap between segments,
 * rounded data end, hover tooltip per bar, legend with text labels, table for screen readers.
 */
const HEIGHT = 160;

const cssVars = {
  '--viz-ok': '#2a78d6',
  '--viz-error': '#d03b3b',
  '--viz-surface': 'var(--mui-palette-background-paper)',
  '[data-mui-color-scheme="dark"] &, .dark &': { '--viz-ok': '#3987e5' },
};

function hourLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RequestsChart({ data }: { data: HourSlot[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) {
    return <Typography color="text.secondary">No requests in this time range.</Typography>;
  }
  const max = Math.max(...data.map((d) => d.requests), 1);
  const slot = 100 / data.length;
  const active = hover !== null ? data[hover] : null;

  return (
    <Box sx={cssVars}>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }} aria-hidden="true">
        <Stack sx={{ alignItems: 'center' }} direction="row" spacing={0.75}>
          <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'var(--viz-ok)' }} />
          <Typography variant="caption" color="text.secondary">Requests</Typography>
        </Stack>
        <Stack sx={{ alignItems: 'center' }} direction="row" spacing={0.75}>
          <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'var(--viz-error)' }} />
          <Typography variant="caption" color="text.secondary">Server errors (5xx)</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
          max {max} / hour
        </Typography>
      </Stack>
      <Box sx={{ position: 'relative' }}>
        <svg width="100%" height={HEIGHT} viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2="100" y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke="currentColor" strokeOpacity="0.2" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => {
            const total = (d.requests / max) * (HEIGHT - 4);
            const errors = (d.errors / max) * (HEIGHT - 4);
            const ok = Math.max(0, total - errors);
            const x = i * slot + slot * 0.15;
            const w = slot * 0.7;
            return (
              <g key={d.hour} opacity={hover === null || hover === i ? 1 : 0.45}>
                {ok > 0 && <rect x={x} width={w} y={HEIGHT - ok} height={ok} fill="var(--viz-ok)" rx="0.6" />}
                {errors > 0 && (
                  <rect x={x} width={w} y={HEIGHT - total} height={Math.max(0, errors - (ok > 0 ? 2 : 0))} fill="var(--viz-error)" rx="0.6" />
                )}
                <rect
                  x={i * slot}
                  width={slot}
                  y={0}
                  height={HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {active && hover !== null && (
          <Box
            role="tooltip"
            sx={{
              position: 'absolute',
              top: 0,
              left: `${Math.min(80, hover * slot)}%`,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              pointerEvents: 'none',
            }}
          >
            <Typography variant="caption" component="div">{hourLabel(active.hour)}</Typography>
            <Typography variant="caption" component="div">{active.requests} requests</Typography>
            <Typography variant="caption" component="div">{active.errors} server errors</Typography>
          </Box>
        )}
      </Box>
      <Stack sx={{ justifyContent: 'space-between' }} direction="row" aria-hidden="true">
        <Typography variant="caption" color="text.secondary">{hourLabel(data[0].hour)}</Typography>
        <Typography variant="caption" color="text.secondary">{hourLabel(data[data.length - 1].hour)}</Typography>
      </Stack>
      <table className="visually-hidden" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        <caption>Requests and server errors per hour</caption>
        <thead>
          <tr><th>Hour</th><th>Requests</th><th>Server errors</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.hour}><td>{hourLabel(d.hour)}</td><td>{d.requests}</td><td>{d.errors}</td></tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
