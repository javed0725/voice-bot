/**
 * The frontend and backend are deployed as two separate services. On
 * Replit's own preview/deployment domains, relative `/api/...` requests
 * already resolve correctly. But when this frontend build is deployed
 * elsewhere (e.g. a separate Vercel project pointed at this repo), there is
 * no backend at that domain, so relative requests 404/fail — the backend
 * only exists on its Replit deployment URL.
 *
 * `VITE_API_URL` lets the hosting platform (e.g. Vercel project settings)
 * override this per-deployment at build time; the hardcoded value below is
 * the fallback so things still work if that env var isn't set.
 */
const REPLIT_BACKEND_URL = 'https://voice-bot--dynamicedubd202.replit.app';

function isLocalOrReplitHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.replit.dev') ||
    hostname.endsWith('.repl.co') ||
    hostname.endsWith('.replit.app')
  );
}

/**
 * Returns the absolute API base URL to use, or `null` when relative
 * same-origin requests are already correct (local dev, Replit preview, or
 * a Replit deployment domain).
 */
export function resolveApiBaseUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const { hostname } = window.location;
  if (isLocalOrReplitHost(hostname)) return null;

  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return configured && configured.trim() !== '' ? configured.trim() : REPLIT_BACKEND_URL;
}
