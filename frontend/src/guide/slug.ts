/** Heading anchor rule. Must match slugify() in backend/src/rag/chunking.py (chatbot links use it). */
export function slugify(text: string): string {
  return text
    .replace(/[`*_~[\]()]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .replace(/\s/g, '-');
}
