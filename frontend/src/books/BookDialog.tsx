import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Rating,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import type { BookDetail, BooksApi } from './api';
import BookCover from './BookCover';

interface Props {
  bookId: number;
  detail: BooksApi['detail'];
  onClose: () => void;
  onOpenBook: (id: number) => void;
  onAuthor: (name: string) => void;
  onNotFound: () => void;
}

export default function BookDialog({ bookId, detail, onClose, onOpenBook, onAuthor, onNotFound }: Props) {
  const { t, i18n } = useTranslation();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let live = true;
    setBook(null);
    setError('');
    detail(bookId).then(
      (b) => live && setBook(b),
      (e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) onNotFound();
        else setError(t('book.loadError'));
      },
    );
    return () => {
      live = false;
    };
  }, [bookId, detail, onNotFound, t, i18n.language]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(t('book.copied', { what }));
    } catch {
      setCopied(t('book.copyFailed'));
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="book-dialog-title" scroll="paper">
      <DialogTitle id="book-dialog-title" sx={{ pr: 6 }}>
        {book ? book.title : t('book.loading')}
        <IconButton aria-label={t('common.close')} onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!book && !error && <Skeleton variant="rounded" height={240} />}
        {book && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <BookCover title={book.title} color={book.coverColor} size="lg" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1">
                  {t('book.by')}{' '}
                  {book.authors.map((a, i) => (
                    <span key={a}>
                      {i > 0 && ', '}
                      <Link component="button" variant="subtitle1" onClick={() => onAuthor(a)} data-testid="book-author">
                        {a}
                      </Link>
                    </span>
                  ))}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', my: 1 }}>
                  <Rating value={book.rating} precision={0.1} readOnly size="small" aria-hidden="true" />
                  <Typography variant="body2">
                    {t('book.ratings', { rating: book.rating.toLocaleString(i18n.language, { minimumFractionDigits: 1 }), count: book.ratingCount.toLocaleString(i18n.language) })}
                  </Typography>
                </Stack>
                <Typography sx={{ mb: 1 }}>{book.description}</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {book.genres.map((g) => <Chip key={g} size="small" label={t(`values.genre.${g}`)} />)}
                  {book.award && <Chip size="small" color="secondary" label={`${book.award.name} ${book.award.year}`} />}
                  {book.series && <Chip size="small" variant="outlined" label={t('book.series', { name: book.series.name, position: book.series.position, size: book.series.size })} />}
                </Stack>
              </Box>
            </Stack>
            <Table size="small" aria-label={t('book.details')}>
              <TableBody>
                <TableRow>
                  <TableCell component="th">{t('book.isbn')}</TableCell>
                  <TableCell>
                    <span data-testid="book-isbn">{book.isbn}</span>
                    <IconButton size="small" aria-label={t('book.copyIsbn')} onClick={() => copy(book.isbn, 'ISBN')} sx={{ ml: 1 }}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow><TableCell component="th">{t('book.pages')}</TableCell><TableCell>{book.pages}</TableCell></TableRow>
                <TableRow><TableCell component="th">{t('book.publisher')}</TableCell><TableCell>{book.publisher}</TableCell></TableRow>
                <TableRow><TableCell component="th">{t('book.published')}</TableCell><TableCell>{new Date(book.publishedDate).toLocaleDateString(i18n.language, { timeZone: 'UTC' })}</TableCell></TableRow>
                <TableRow><TableCell component="th">{t('book.language')}</TableCell><TableCell>{t(`values.language.${book.language}`)}</TableCell></TableRow>
              </TableBody>
            </Table>
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>{t('book.formats')}</Typography>
              <Stack spacing={1}>
                {book.formats.map((f) => (
                  <Stack key={f.type} direction="row" spacing={1} sx={{ alignItems: 'center' }} data-testid="book-format">
                    <Typography sx={{ minWidth: 100 }}>{t(`values.format.${f.type}`)}</Typography>
                    <Typography sx={{ minWidth: 70, fontWeight: 600 }}>${f.price.toFixed(2)}</Typography>
                    {f.inStock ? (
                      <Chip size="small" color="success" variant="outlined" label={t('book.inStock')} />
                    ) : (
                      <Chip size="small" variant="outlined" label={f.expectedDate ? t('book.outOfStockExpected', { date: f.expectedDate }) : t('book.outOfStock')} />
                    )}
                  </Stack>
                ))}
              </Stack>
            </Box>
            {!!book.similar.length && (
              <Box>
                <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>{t('book.similar')}</Typography>
                <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }} component="ul" aria-label={t('book.similar')} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {book.similar.map((s) => (
                    <li key={s.id}>
                      <Button onClick={() => onOpenBook(s.id)} sx={{ flexDirection: 'column', alignItems: 'flex-start', width: 120, textTransform: 'none' }} data-testid="similar-book">
                        <BookCover title={s.title} color={s.coverColor} size="sm" />
                        <Typography variant="caption" sx={{ mt: 0.5, textAlign: 'left' }} data-testid="similar-title">{s.title}</Typography>
                      </Button>
                    </li>
                  ))}
                </Stack>
              </Box>
            )}
            <Box>
              <Button startIcon={<LinkIcon />} onClick={() => copy(`${window.location.origin}/?book=${book.id}`, t('book.copyLink'))}>
                {t('book.copyLink')}
              </Button>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <Snackbar open={!!copied} autoHideDuration={2500} onClose={() => setCopied('')} message={copied} />
    </Dialog>
  );
}
