/**
 * Centralized application configuration.
 *
 * Reads from Vite environment variables at build time, falling back to
 * sensible defaults for local development.
 */

export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, '') ||
  'http://localhost:8000';
