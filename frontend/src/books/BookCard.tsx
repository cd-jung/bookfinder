import { Box, Card, CardActionArea, Chip, Rating, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { BookCardData } from './api';
import BookCover from './BookCover';

export default function BookCard({ book, view, onOpen }: { book: BookCardData; view: 'grid' | 'list'; onOpen: (id: number, el: HTMLElement) => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Card variant="outlined" data-testid="book-card" sx={{ height: '100%' }}>
      <CardActionArea
        onClick={(e) => onOpen(book.id, e.currentTarget)}
        aria-label={t('book.cardLabel', { title: book.title, authors: book.authors.join(', ') })}
        data-book-id={book.id}
        sx={{ height: '100%', p: 1.5, display: 'flex', flexDirection: view === 'grid' ? 'column' : 'row', alignItems: view === 'grid' ? 'center' : 'flex-start', gap: 1.5 }}
      >
        <BookCover title={book.title} color={book.coverColor} size={view === 'grid' ? 'md' : 'sm'} />
        <Box sx={{ minWidth: 0, width: '100%' }}>
          <Typography variant="subtitle2" component="h3" data-testid="book-card-title" sx={{ fontWeight: 600 }}>
            {book.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" data-testid="book-card-author">
            {book.authors.join(', ')}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" data-testid="book-card-year">{book.year}</Typography>
            <Typography variant="body2" color="text.secondary" data-testid="book-card-language" data-value={book.language}>{t(`values.language.${book.language}`)}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Rating value={book.rating} precision={0.1} readOnly size="small" aria-hidden="true" />
            <Typography variant="body2" data-testid="book-card-rating">{book.rating.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }} data-testid="book-card-price">${book.price.toFixed(2)}</Typography>
            <Chip
              size="small"
              label={book.inStock ? t('book.inStock') : t('book.outOfStock')}
              color={book.inStock ? 'success' : 'default'}
              variant="outlined"
              data-testid="book-card-availability"
            />
          </Stack>
        </Box>
      </CardActionArea>
    </Card>
  );
}
