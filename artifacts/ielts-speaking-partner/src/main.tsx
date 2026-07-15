import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { resolveApiBaseUrl } from './lib/api-base-url';

import './index.css';

const apiBaseUrl = resolveApiBaseUrl();
if (apiBaseUrl) setBaseUrl(apiBaseUrl);

createRoot(document.getElementById('root')!).render(<App />);

// Register the PWA service worker so the app can be installed to the
// homescreen/desktop and work offline. Skipped in dev to avoid caching
// issues with hot-reloaded assets.
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
