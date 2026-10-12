/** User Guide pages, bundled from docs/user-guide/<lang>/*.md (the same files the RAG index uses). */
export interface GuidePage {
  slug: string; // file name without .md, e.g. "05-help-assistant" (the same in every language)
  title: string; // first "# " heading
  content: string;
}

const files = import.meta.glob('../../../docs/user-guide/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function parsePages(source: Record<string, string>): GuidePage[] {
  return Object.entries(source)
    .map(([path, content]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '');
      const title = content.match(/^#\s+(.+)$/m)?.[1].trim() ?? slug;
      return { slug, title, content };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Group "<dir>/<lang>/<page>.md" files by language. */
export function pagesByLanguage(source: Record<string, string>): Record<string, GuidePage[]> {
  const byLang: Record<string, Record<string, string>> = {};
  for (const [path, content] of Object.entries(source)) {
    const lang = path.split('/').slice(-2)[0];
    (byLang[lang] ??= {})[path] = content;
  }
  return Object.fromEntries(Object.entries(byLang).map(([lang, files]) => [lang, parsePages(files)]));
}

export const GUIDE_BY_LANG = pagesByLanguage(files);

/** Pages in `lang`, falling back to English for any page not translated yet. */
export function guidePages(lang: string): GuidePage[] {
  const english = GUIDE_BY_LANG.en ?? [];
  const local = new Map((GUIDE_BY_LANG[lang] ?? []).map((p) => [p.slug, p]));
  return english.map((p) => local.get(p.slug) ?? p);
}

export const GUIDE_PAGES = guidePages('en');
