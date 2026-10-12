/** User Guide pages, bundled from docs/user-guide/*.md (the same files the RAG index uses). */
export interface GuidePage {
  slug: string; // file name without .md, e.g. "02-help-assistant"
  title: string; // first "# " heading
  content: string;
}

const files = import.meta.glob('../../../docs/user-guide/*.md', {
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

export const GUIDE_PAGES = parsePages(files);
