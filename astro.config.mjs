// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  /*
    In Astro 6, the default output is "static" — pages are pre-rendered
    at build time (fast). Any file with `export const prerender = false`
    runs ON DEMAND on the server instead, which is how our /api/leads
    endpoint works. No extra config needed; this is the default.
  */
  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()]
  }
});