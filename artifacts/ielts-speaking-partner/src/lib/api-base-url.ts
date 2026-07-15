/**
 * Returns the API base URL prefix, or `null` to use relative same-origin
 * requests (the default everywhere).
 *
 * On Replit (dev or deployed): the Vite dev-server proxy and Replit's own
 * reverse-proxy both route `/api/*` to the Express API server.
 *
 * On Vercel: Vercel serverless functions in `api/` handle `/api/transcribe`
 * and `/api/gemini/chat` directly — no separate backend needed.
 *
 * `VITE_API_URL` can still override this at build time if you ever need to
 * point at a different backend (e.g. a dedicated API deployment).
 */
export function resolveApiBaseUrl(): string | null {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured && configured.trim() !== '') return configured.trim();
  // Relative URLs work on every platform (Replit dev, Replit deployment,
  // Vercel) so there is no need to hard-code a hostname here.
  return null;
}
