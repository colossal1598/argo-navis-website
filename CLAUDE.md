APM_RULES {

## Aesthetics (any UI work)

- **No pill shapes.** Buttons, badges, tags, inputs use small-radius rectangles. Never `rounded-full` — exceptions: avatars, toggle knobs, tiny decorative marker dots (≤8px, e.g. the case-study stat dots).
- Depth is allowed and wanted (owner decision 2026-08-27): raised panels with restrained physical elevation — soft two-layer shadows, gentle top-light gloss gradients, 1px inset catch-lights (see `.strip-panel` tokens). Light theme leans white/lit; dark theme elevates one surface step. Still banned: stock glassmorphism, blur, neon glow, purple-gradient clichés, meaningless blobs — the User rejects pages that look AI-generated. Decoration must serve function.
- Style through the design tokens and component classes in `src/styles/global.css` (`@theme`). Do not repeat long ad-hoc utility strings; if a pattern is used twice, it belongs in a token or class.
- Every page must render correctly in dark and light themes and mobile-first before it is considered done.

## RTL / Localization (any page or component work)

- Direction-sensitive spacing uses logical properties/classes only: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rtl:` variants. Never `ml-`/`mr-`/`left-`/`right-` for layout that must mirror.
- No hard-coded user-facing strings in shared components — all copy arrives via props/locale objects. English pages live at root, Hebrew mirrors under `/he` with `dir="rtl"`.

## Content honesty (any user-facing text)

- Real numbers only — every metric must be traceable to a real project source. Never invent clients, testimonials, metrics, or case-study details.
- Never publish client names, client domains, or production domains of internal systems. Real magnitudes are allowed; identifying details are not.
- Voice: direct and human, short sentences, no marketing fluff ("innovative solutions", "seamless experience" — delete). No corporate register — the reader is a small-business owner, not an org chart: "leadership", "stakeholders", "executives", "personnel" → "the owner", "you", "your people". Real numbers beat adjectives; lead with the reader's pain, not the technology. If a sentence could appear unchanged on a competitor's site, rewrite or delete it.
- English technical terms stay in English inside Hebrew text (API, RLS, static export).
- Customer-facing copy is non-technical: no developer metrics (commit counts, file counts, API-route counts) — describe what the system/automation does for the business. Business-meaningful numbers (spreadsheets migrated, documents synced, build time in days/weeks, ₪ cost) are what count.

## Code conventions

- New pages and major page edits start with a short `PAGE GOAL` comment (conversion intent) and section-level comments before key blocks (Hero, Problem, FAQ, Contact…). Comments say what to change and why the block exists — practical, editable-focused.
- Keep code matching the existing annotated Astro style; TypeScript strict; no new dependencies without need (budget is zero).

## Version Control

- Base branch: `main`. Branches: `type/short-description` (e.g. `feat/design-tokens`). Commits: `type: description` — types: feat, fix, refactor, docs, test, chore.
- **Never push to any remote.** A push to `main` triggers a production deploy (Cloudflare Pages); deploys are User-coordinated only. Workers commit on their assigned branch and never merge.

## Workflow

- **Never start dev servers, watchers, or any resident process without explicit User approval** — the machine is load-sensitive. Transient commands (build, typecheck, scripts) are fine.
- No secrets in the repo — env vars live in `.env` (gitignored) and Cloudflare Pages settings only.
- For bulk reading or research (many files, external repos, long docs), use subagents to keep your context lean; never open large data files (.ods/.xlsx) directly.
- User-facing messages and questions: short and concise. When a task requires User review, present the artifact and ask plainly.

} //APM_RULES
