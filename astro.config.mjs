// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  /*
    SITE URL — must match the production domain so that canonical URLs,
    hreflang alternates, and the auto-generated sitemap are correct.
  */
  site: 'https://argo-navis.net',

  /*
    In Astro 6, the default output is "static" — pages are pre-rendered
    at build time (fast). Any file with `export const prerender = false`
    runs ON DEMAND on the server instead, which is how our /api/leads
    endpoint works. No extra config needed; this is the default.
  */
  adapter: cloudflare(),

  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()]
  }
});