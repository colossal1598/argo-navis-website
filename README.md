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
  - Captures `name`, `email`, optional `website`, `message`, and `source`.
  - Captures preferred contact channel in this order: `email` → `phone` → `telegram` → `whatsapp`.
  - For non-email channels, opens and requires a channel-specific contact details input.
  - Turnstile token is verified server-side before insert.
  - Multiple form “types” possible (e.g., discovery call, audit request, custom quote).
  - No email provider integration (no Resend).

## Tech Stack

- **Framework**: Astro
- **Language**: TypeScript/JavaScript (Astro components + vanilla JS islands)
- **Styling**: Tailwind CSS
- **Database**: Supabase (Postgres) for storing form submissions
- **Bot protection**: Cloudflare Turnstile (form verification)
- **Localization**: English (default) + Hebrew routes under `/he/...` with RTL layout
- **Navigation UX**: Language and theme controls are icon-only (flag and sun/moon)
- **Deployment**: Cloudflare Pages (with `@astrojs/cloudflare`)

## Leads Table Columns (Current)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | `uuid` | yes | auto-generated primary key |
| `name` | `text` | yes | lead name |
| `email` | `text` | yes | validated in API |
| `website` | `text` | no | optional |
| `contact_method` | `text` | yes | `email` \| `phone` \| `telegram` \| `whatsapp` |
| `contact_details` | `text` | no | required in API when method is not `email` |
| `message` | `text` | yes | lead message |
| `source` | `text` | yes | page/form source tag |
| `created_at` | `timestamptz` | yes | auto `now()` |

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
   - `PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare Turnstile site key (safe on client)
   - `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret key (server only)

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

   Set the same env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) in
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
    he/
      index.astro         ← Hebrew landing page (`/he`)
      automations/index.astro
      websites/index.astro
      campaigns/index.astro
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
    locale.ts             ← locale path helpers (EN/HE switch)
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
| Light/Dark tokens | `src/styles/global.css` → semantic `--theme-*` variables |
| Nav links | `src/components/Navigation.astro` → `navLinks` array |
| Language switch behavior | `src/components/Navigation.astro` + `src/lib/locale.ts` |
| Hero headline / copy | `src/components/Hero.astro` → top variables |
| Service cards | `src/components/ServicesSection.astro` → `services` array |
| Footer columns | `src/components/Footer.astro` → `columns` array |
| Form fields | `src/components/ContactForm.astro` → `fields` array |
| Contact method buttons | `src/components/ContactForm.astro` → `contactMethods` (order controls button order) |
| Channel details field | `src/components/ContactForm.astro` → `contactDetailsRequiredText` + `contactDetailsPlaceholders` |
| Contact DB columns | `src/lib/schema.sql` (`contact_method`, `contact_details`) |
| Supabase table name | `src/pages/api/leads.ts` → `TABLE` constant |
| Turnstile enforcement | `src/pages/api/leads.ts` (strict in production, soft in development) |

---

## Code Documentation Convention (Required)

For all **new pages** and for major edits to existing pages/components:

- Add a short `PAGE GOAL` comment near the top of the file explaining conversion intent.
- Add section-level comments before key blocks (Hero, Problem, Process, FAQ, Contact, etc.).
- Keep comments practical and editable-focused (what to change, why the block exists).
- When adding localized pages (`/he/...`), keep structure mirrored to EN and document any intentional differences.

This keeps future changes consistent with the existing annotated style used across the project.

---

## Adding a New Showcase Page

1. Duplicate `src/pages/automations/crm-slack-routing.astro`
2. Move it to the right service folder (`/websites/`, `/campaigns/`, etc.)
3. Update the `ShowcaseLayout` props and the three `ShowcaseSection` blocks
4. Add a `ShowcaseCard` entry to the parent service page's `showcases` array