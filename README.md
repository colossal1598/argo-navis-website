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

> Steps will be refined as the project is initialized.

1. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install