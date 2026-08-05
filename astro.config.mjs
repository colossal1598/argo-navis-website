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

  /*
    SITEMAP — filter excludes /styleguide (and its /he mirror, if one
    ever exists): it's already noindexed on-page (Layout's `noindex`
    prop), but the sitemap integration doesn't read that prop — it was
    still being listed, which is inconsistent with "don't index this"
    (launch verification finding, Task 4.1). /thank-you (+ /he mirror)
    excluded the same way (Task 4.6) — a post-conversion redirect
    target, also noindexed on-page, not content that should rank.
  */
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/styleguide') && !page.includes('/thank-you'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});