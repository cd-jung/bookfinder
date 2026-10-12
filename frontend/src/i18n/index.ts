import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { ko } from './locales/ko';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ko', label: '한국어' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'app-language';
const isLang = (value: unknown): value is Lang => LANGUAGES.some((l) => l.code === value);

/** Saved choice, else the browser language, else English. */
export function initialLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language.slice(0, 2);
  return isLang(browser) ? browser : 'en';
}

export function setLanguage(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* per-viewer convenience only */
  }
  void i18n.changeLanguage(lang);
}

export function currentLanguage(): Lang {
  return isLang(i18n.language) ? i18n.language : 'en';
}

i18n.on('languageChanged', (lang) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
});

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es }, fr: { translation: fr }, ko: { translation: ko } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
