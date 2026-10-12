// @ts-check
/** Languages (flow 11): English, Spanish, French and Korean across the app. */
const { test, expect } = require('@playwright/test');
const { results } = require('./helpers');

async function choose(page, label) {
  await page.getByRole('combobox', { name: /Display language|Idioma de la interfaz|Langue d'affichage|표시 언어/ }).click();
  await page.getByRole('option', { name: label }).click();
}

test.describe('Switching', () => {
  test('[I18N-001] Display language offers four languages; each switches menu and search labels', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await page.getByRole('combobox', { name: 'Display language' }).click();
    await expect(page.getByRole('option')).toHaveText(['English', 'Español', 'Français', '한국어']);
    await page.keyboard.press('Escape');
    for (const [label, search, guide, tab] of [
      ['Español', 'Búsqueda de libros', 'Guía del usuario', 'Palabras clave y filtros'],
      ['Français', 'Recherche de livres', "Guide de l'utilisateur", 'Mots-clés et filtres'],
      ['한국어', '도서 검색', '사용자 가이드', '키워드 및 필터'],
      ['English', 'Book Search', 'User Guide', 'Keyword & filters'],
    ]) {
      await choose(page, label);
      const menu = page.getByRole('navigation').first();
      await expect(menu.getByRole('link', { name: search })).toBeVisible();
      await expect(menu.getByRole('link', { name: guide })).toBeVisible();
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('[I18N-002] the chosen language is remembered after reload', async ({ page }) => {
    await page.goto('/');
    await choose(page, '한국어');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await page.reload();
    await expect(page.getByRole('heading', { name: '책 찾기' })).toBeVisible();
    await expect(page.getByTestId('result-count')).toHaveText('책 10,000권');
  });

  test.describe('browser language', () => {
    test.use({ locale: 'ko-KR' });
    test('[I18N-003] first visit uses the browser language', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: '책 찾기' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: '표시 언어' })).toHaveText(/한국어/);
    });
  });

  test.describe('unsupported browser language', () => {
    test.use({ locale: 'de-DE' });
    test('[I18N-003] an unsupported browser language falls back to English', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Find books' })).toBeVisible();
    });
  });
});

test.describe('Content', () => {
  test('[I18N-004] the User Guide shows the page in the chosen language', async ({ page }) => {
    await page.goto('/guide/02-searching-books');
    await expect(page.getByTestId('guide-article').getByRole('heading', { level: 1 })).toHaveText('Searching for Books');
    for (const [label, title] of [['Español', 'Buscar libros'], ['Français', 'Rechercher des livres'], ['한국어', '책 검색하기']]) {
      await choose(page, label);
      await expect(page.getByTestId('guide-article').getByRole('heading', { level: 1 })).toHaveText(title);
    }
    await expect(page.getByTestId('guide-article')).toHaveAttribute('lang', 'ko');
  });

  test('[I18N-005] Help answers in the chosen language with links to that guide', async ({ page }) => {
    await page.goto('/');
    await choose(page, '한국어');
    await page.getByRole('button', { name: '도움말', exact: true }).click();
    const chat = page.getByRole('complementary', { name: '도움말 채팅' });
    await expect(chat).toContainText('BookFinder 사용법을 알려 드릴게요');
    const input = chat.getByRole('textbox', { name: '질문 입력' });
    await input.fill('가격 필터는 어떻게 쓰나요?');
    await input.press('Enter');
    const answer = chat.getByTestId('chat-answer').last();
    await expect(answer).toContainText(/[가-힣]/);
    const source = chat.getByTestId('chat-source').first();
    await expect(source).toHaveAttribute('href', /^\/guide\/02-searching-books#/);
    const href = await source.getAttribute('href');
    await source.click();
    await expect(page.locator(href.slice(href.indexOf('#')))).toBeInViewport();
    await expect(page.getByTestId('guide-article').getByRole('heading', { level: 1 })).toHaveText('책 검색하기');
    await input.fill('오늘 서울 날씨 알려줘');
    await input.press('Enter');
    await expect(chat.getByTestId('chat-answer').last()).toHaveText(/사용자 가이드에서 찾지 못했어요/);
  });

  test('[I18N-006] Interpreted as and the example questions are in the chosen language', async ({ page }) => {
    await page.goto('/');
    await choose(page, '한국어');
    await page.getByRole('tab', { name: '자연어로 질문 (AI)' }).click();
    const chip = page.getByTestId('nl-example').first();
    await expect(chip).toHaveText('2015년 이후 20달러 미만 별점 4점 이상 한국 소설');
    await chip.click();
    await expect(page.getByRole('status')).toContainText('해석 결과: (언어: 한국어 그리고 장르: 문학 그리고 2015년보다 나중에 출판 그리고 가격 $20 미만 그리고 평점 4 이상)');
  });

  test('[I18N-007] genres, formats, languages and descriptions are translated; titles are not', async ({ page }) => {
    await page.goto('/?book=1');
    await expect(page.getByRole('dialog', { name: 'Dune' })).toContainText('Science fiction');
    await page.keyboard.press('Escape');
    await choose(page, 'Français');
    await page.goto('/?book=1');
    await expect(page.getByRole('dialog', { name: 'Dune' })).toContainText('Science-fiction');
    await expect(page.getByRole('dialog', { name: 'Dune' })).toContainText('Parmi des colonies lointaines');
    await expect(page.getByRole('dialog', { name: 'Dune' })).toContainText('Frank Herbert');
    await expect(page.getByRole('dialog', { name: 'Dune' }).getByTestId('book-format').first()).toContainText(/Relié|Broché|Livre numérique|Livre audio/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('checkbox', { name: /^Policier/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Langue', exact: true })).toBeVisible();
  });
});
