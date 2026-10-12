/** App-wide constants. APP_NAME is rewritten by scripts/apply-config.mjs from project.config.json. */
export const APP_NAME = 'BookFinder';

/** API origin. Empty in development (Vite proxies /api); set VITE_API_BASE at build time for the deployed site. */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

/**
 * Which site this build is: "public" (search, guide, help), "admin" (logs, monitoring, coverage; behind
 * Cloudflare Access) or "all" (local development and E2E). Pages of the other site link to its URL.
 */
export type Site = 'public' | 'admin' | 'all';
export const SITE: Site = (import.meta.env.VITE_SITE as Site) || 'all';
export const ADMIN_URL: string = import.meta.env.VITE_ADMIN_URL ?? '';
export const PUBLIC_URL: string = import.meta.env.VITE_PUBLIC_URL ?? '';
