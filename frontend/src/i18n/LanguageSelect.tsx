import { MenuItem, Select } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Lang } from './index';

/** Display language picker in the top-right corner of the header. */
export default function LanguageSelect() {
  const { t, i18n } = useTranslation();
  return (
    <Select
      size="small"
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value as Lang)}
      startAdornment={<TranslateIcon fontSize="small" sx={{ mr: 1 }} />}
      inputProps={{ 'aria-label': t('app.displayLanguage') }}
      sx={{ color: 'inherit', '& .MuiSelect-icon': { color: 'inherit' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
      data-testid="language-select"
    >
      {LANGUAGES.map((l) => (
        <MenuItem key={l.code} value={l.code} lang={l.code}>
          {l.label}
        </MenuItem>
      ))}
    </Select>
  );
}
