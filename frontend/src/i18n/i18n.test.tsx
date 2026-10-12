import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { renderAt } from '../test/render';
import i18n, { currentLanguage, initialLanguage, LANGUAGES, setLanguage } from './index';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { ko } from './locales/ko';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe('i18n', () => {
  it('every locale has exactly the English keys and no empty text', () => {
    const english = keys(en).sort();
    for (const locale of [es, fr, ko]) {
      expect(keys(locale).sort()).toEqual(english);
      expect(JSON.stringify(locale)).not.toContain('""');
    }
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'es', 'fr', 'ko']);
  });

  it('picks the saved language, then the browser language, then English', () => {
    localStorage.setItem('app-language', 'fr');
    expect(initialLanguage()).toBe('fr');
    localStorage.setItem('app-language', 'xx');
    Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
    expect(initialLanguage()).toBe('ko');
    Object.defineProperty(navigator, 'language', { value: 'de-DE', configurable: true });
    expect(initialLanguage()).toBe('en');
    localStorage.clear();
  });

  it('setLanguage saves the choice and updates <html lang>', async () => {
    setLanguage('es');
    await waitFor(() => expect(document.documentElement.lang).toBe('es'));
    expect(localStorage.getItem('app-language')).toBe('es');
    expect(currentLanguage()).toBe('es');
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  it('the header select switches the whole layout', async () => {
    renderAt(<App />, '/guide');
    await userEvent.click(screen.getByRole('combobox', { name: 'Display language' }));
    await userEvent.click(screen.getByRole('option', { name: '한국어' }));
    expect(await screen.findByRole('combobox', { name: '표시 언어' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '도움말' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '시작하기' })).toBeInTheDocument();
  });
});
