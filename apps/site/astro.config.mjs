import { defineConfig } from 'astro/config';

// SITE_URL / SITE_BASE let the preview deploy serve from a sub-path (e.g. GitHub Pages).
export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.SITE_BASE ?? '/',
});
