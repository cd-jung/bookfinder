/** App-wide constants. APP_NAME is rewritten by scripts/apply-config.mjs from project.config.json. */
export const APP_NAME = 'My App';

/** API origin. Empty in development (Vite proxies /api); set VITE_API_BASE at build time for Pages. */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
