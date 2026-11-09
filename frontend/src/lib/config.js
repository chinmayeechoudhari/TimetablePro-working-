/**
 * Centralized application configuration.
 *
 * Reads from Vite environment variables at build time, falling back to
 * sensible defaults for local development.
 */

export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, '') ||
  (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'http://localhost:8000');
