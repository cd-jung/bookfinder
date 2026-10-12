import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../i18n';

void i18n.changeLanguage('en');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.sessionStorage?.clear();
  void i18n.changeLanguage('en');
});
