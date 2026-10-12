import { Alert, Box, Card, CardContent, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { useTranslation } from 'react-i18next';
import type { Metric, Resources } from './api';

/** Status colours (reserved, never used for series) with an icon and a word, so colour is never the only cue. */
const STATUS = {
  ok: { color: '#0ca30c', Icon: CheckCircleOutlined },
  watch: { color: '#b8860b', Icon: WarningAmberOutlined },
  critical: { color: '#d03b3b', Icon: ErrorOutlined },
} as const;

export function statusOf(share: number): keyof typeof STATUS {
  if (share >= 0.85) return 'critical';
  if (share >= 0.6) return 'watch';
  return 'ok';
}

function formatValue(m: Metric, lang: string) {
  const n = (v: number, digits = 0) => v.toLocaleString(lang, { maximumFractionDigits: digits });
  if (m.unit === 'bytes') {
    const units = ['B', 'KB', 'MB', 'GB'];
    const at = (v: number) => {
      let i = 0;
      let x = v;
      while (x >= 1024 && i < units.length - 1) {
        x /= 1024;
        i += 1;
      }
      return `${n(x, 1)} ${units[i]}`;
    };
    return `${at(m.value)} / ${at(m.limit)}`;
  }
  if (m.unit === 'ms') return `${n(m.value, 1)} ms / ${n(m.limit)} ms`;
  if (m.unit === '%') return `${n(m.value, 2)}% / ${n(m.limit, 2)}%`;
  return `${n(m.value)} / ${n(m.limit)}`;
}

function Gauge({ metric }: { metric: Metric }) {
  const { t, i18n } = useTranslation();
  const status = statusOf(metric.share);
  const { color, Icon } = STATUS[status];
  const percent = Math.round(metric.share * 1000) / 10;
  return (
    <Card variant="outlined" sx={{ flex: '1 1 220px' }} data-testid={`gauge-${metric.key}`} data-status={status}>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Tooltip title={t(`logs.headroom.help.${metric.key}`)}>
            <Typography variant="body2" color="text.secondary">{t(`logs.headroom.metric.${metric.key}`)}</Typography>
          </Tooltip>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color }}>
            <Icon fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{t(`logs.headroom.status.${status}`)}</Typography>
          </Stack>
        </Stack>
        <Typography variant="h5" component="p" data-testid={`gauge-${metric.key}-percent`}>{percent}%</Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, percent)}
          aria-label={t(`logs.headroom.metric.${metric.key}`)}
          sx={{ height: 8, borderRadius: 4, my: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }}
        />
        <Typography variant="caption" color="text.secondary">{formatValue(metric, i18n.language)}</Typography>
        {metric.extra && (
          <Typography variant="caption" color="text.secondary" component="p">
            {Object.entries(metric.extra).map(([k, v]) => `${k} ${v.toLocaleString(i18n.language)}`).join(' · ')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/** "Resource headroom": every limit as % used, coloured green / amber / red at 60 % and 85 %. */
export default function ResourceHeadroom({ data }: { data: Resources }) {
  const { t } = useTranslation();
  return (
    <Box component="section" aria-label={t('logs.headroom.title')}>
      <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>{t('logs.headroom.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('logs.headroom.legend')}</Typography>
      <Typography variant="overline" component="h3">{t('logs.headroom.app')}</Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
        {data.app.map((m) => <Gauge key={m.key} metric={m} />)}
      </Stack>
      <Typography variant="overline" component="h3">{t('logs.headroom.cloudflare')}</Typography>
      {data.cloudflare.available ? (
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {data.cloudflare.metrics.map((m) => <Gauge key={m.key} metric={m} />)}
        </Stack>
      ) : (
        <Alert severity="info" data-testid="cloudflare-unavailable">
          {data.cloudflare.reason === 'not_configured' ? t('logs.headroom.notConfigured') : t('logs.headroom.unavailable', { reason: data.cloudflare.reason })}
        </Alert>
      )}
    </Box>
  );
}
