import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { APP_NAME } from '../config';
import { renderAt } from '../test/render';
import { NAV_ITEMS } from './navItems';
import i18n from '../i18n';

describe('AppLayout', () => {
  // jsdom has no viewport width, so the layout renders as mobile: the menu is a drawer.
  it('renders the header, every menu entry and the Help button', async () => {
    renderAt(<App />);
    expect(screen.getAllByText(APP_NAME).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    NAV_ITEMS.forEach((item) => expect(menu).toHaveTextContent(i18n.t(item.labelKey)));
  });

  it('marks the current page and links Coverage to the static report', async () => {
    renderAt(<App />, '/guide');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('link', { name: 'User Guide' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Coverage' })).toHaveAttribute('href', '/coverage');
  });

  it('shows the not found page for unknown routes', () => {
    renderAt(<App />, '/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
