import { Box } from '@mui/material';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { useTranslation } from 'react-i18next';

/** Generated cover (colour + title), or the placeholder when the book has no cover image. */
export default function BookCover({ title, color, size = 'md' }: { title: string; color: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation();
  const dims = { sm: { w: 56, h: 84, f: 9 }, md: { w: 96, h: 144, f: 12 }, lg: { w: 160, h: 240, f: 16 } }[size];
  if (!color) {
    return (
      <Box
        role="img"
        aria-label={t('book.noCover')}
        data-testid="cover-placeholder"
        sx={{ width: dims.w, height: dims.h, flexShrink: 0, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', color: 'text.secondary' }}
      >
        <MenuBookOutlined />
      </Box>
    );
  }
  return (
    <Box
      role="img"
      aria-label={t('book.coverOf', { title })}
      sx={{
        width: dims.w,
        height: dims.h,
        flexShrink: 0,
        borderRadius: 1,
        bgcolor: color,
        color: '#fff',
        p: 1,
        fontSize: dims.f,
        fontWeight: 600,
        lineHeight: 1.2,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        boxShadow: 1,
      }}
    >
      {title}
    </Box>
  );
}
