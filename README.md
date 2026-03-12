# Argo Navis – Agency Website

Argo Navis is a lead-generation and showcase website for a digital agency.  
It highlights our core services, showcases past work, and drives inbound leads via dynamic forms connected to Supabase.

## Project Overview

- **Agency name**: Argo Navis  
- **Goals**:
  - **Lead gen**: Capture high-intent leads via tailored forms.
  - **Showcases**: Present case studies and examples of our work.
- **Core structure**:
  - **Main landing page**
  - **Service pages**:
    - **Automations**
    - **Websites**
    - **Campaigns**
  - Each service page can have **sub‑pages** for detailed showcases.

## Key Features

- **Main landing page**
  - Clear value proposition and hero section.
  - High-level overview of services (automations, websites, campaigns).
  - Primary calls to action (book a call, request proposal, etc.).

- **Service pages**
  - **Automations**: Automation consulting, implementation, and maintenance.
  - **Websites**: Web design, development, and optimization.
  - **Campaigns**: Campaign strategy, creative, and performance tracking.
  - Each service page links to **showcase sub‑pages** (case studies, examples, or templates).

- **Showcase sub‑pages**
  - Deep dive into specific projects or examples.
  - Problem → solution → results format.
  - Visuals (screenshots, mockups, metrics) where relevant.

- **Lead form generator (Supabase)**
  - Configurable forms for different entry points (main page, service pages, sub‑pages).
  - Form submissions stored in **Supabase**.
  - Multiple form “types” possible (e.g., discovery call, audit request, custom quote).
  - No email provider integration (no Resend).

## Tech Stack

- **Framework**: Astro
- **Language**: TypeScript/JavaScript (Astro components + vanilla JS islands)
- **Styling**: Tailwind CSS
- **Database**: Supabase (Postgres) for storing form submissions
- **Deployment**: (to be decided – e.g. Vercel / Netlify / Cloudflare Pages)

## Project Structure

> This will be adjusted as the project evolves.

Planned structure (Astro-style):

- `src/`
  - `pages/`
    - `index.astro` – main landing page
    - `automations/` – automations service + showcases
    - `websites/` – websites service + showcases
    - `campaigns/` – campaigns service + showcases
  - `components/` – shared UI (navigation, layout, forms, cards, etc.)
  - `lib/` – utilities (Supabase client, form config, helpers)
- `public/` – static assets

## Lead Form Generator (Concept)

- **Config-driven forms**
  - Central config describing fields per form type (e.g., “Automation discovery”, “Website project brief”, “Campaign strategy call”).
  - Pages select the appropriate form configuration.
- **Supabase integration**
  - Astro endpoint(s) to accept form POSTs.
  - Insert submissions into a `leads` table in Supabase.
  - Basic validation and error handling.
- **No email sending for now**
  - Notifications or email workflows can be added later if needed.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in `.env` with your Supabase credentials:
   - `SUPABASE_URL` — found at Supabase Dashboard → Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — found at Settings → API → service_role (secret)

3. **Create the Supabase `leads` table**

   In your Supabase project: **SQL Editor → New query**, paste the contents of
   `src/lib/schema.sql`, and click **Run**.

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   The site will be at `http://localhost:4321`.

5. **Deploy to Cloudflare Pages**

   ```bash
   npm run build
   ```

   Set the same env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) in
   Cloudflare Pages → Settings → Environment variables.

---

## Project Structure (as built)

```
src/
  layouts/
    Layout.astro          ← shared HTML shell, nav, footer
    ShowcaseLayout.astro  ← template for case-study sub-pages
  components/
    Navigation.astro      ← sticky top nav with mobile menu
    Footer.astro          ← footer with link columns
    Hero.astro            ← landing page hero section
    ServicesSection.astro ← three service cards
    ServiceHero.astro     ← hero for each service page
    ShowcaseCard.astro    ← card used in service page grids
    ShowcaseSection.astro ← Problem / Solution / Results block
    ContactForm.astro     ← lead-capture form (posts to /api/leads)
  pages/
    index.astro           ← main landing page
    automations/
      index.astro         ← Automations service page
      crm-slack-routing.astro  ← example showcase sub-page
    websites/
      index.astro         ← Websites service page
    campaigns/
      index.astro         ← Campaigns service page
    api/
      leads.ts            ← POST endpoint — saves form data to Supabase
  lib/
    supabase.ts           ← Supabase client (server-side only)
    schema.sql            ← SQL to create the leads table
  styles/
    global.css            ← Tailwind import + brand design tokens
```

---

## Customisation Quick Reference

| What you want to change | Where to change it |
|---|---|
| Brand colours | `src/styles/global.css` → `@theme` block |
| Nav links | `src/components/Navigation.astro` → `navLinks` array |
| Hero headline / copy | `src/components/Hero.astro` → top variables |
| Service cards | `src/components/ServicesSection.astro` → `services` array |
| Footer columns | `src/components/Footer.astro` → `columns` array |
| Form fields | `src/components/ContactForm.astro` → `fields` array |
| Supabase table name | `src/pages/api/leads.ts` → `TABLE` constant |

---

## Adding a New Showcase Page

1. Duplicate `src/pages/automations/crm-slack-routing.astro`
2. Move it to the right service folder (`/websites/`, `/campaigns/`, etc.)
3. Update the `ShowcaseLayout` props and the three `ShowcaseSection` blocks
4. Add a `ShowcaseCard` entry to the parent service page's `showcases` array

---

## Original README content follows

### Lead Form Generator (Concept)