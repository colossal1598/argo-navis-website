-- Run this once in your Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Column reference:
--   id         auto-generated unique ID
--   name       visitor's name (required)
--   email      primary contact email (required)
--   website    their site URL — optional, may be null
--   contact_method preferred follow-up channel
--                 one of: whatsapp | telegram | phone | email
--   contact_details handle/phone when non-email method is selected
--   message    what they typed in the message field (required)
--   source     which page/form the lead came from
--              e.g. "landing", "websites", "automations", "campaigns"
--   created_at set automatically on insert

create table if not exists leads (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  email      text        not null,
  website    text,                    -- nullable — not every visitor has a site
  contact_method text   not null default 'email',
  contact_details text,
  message    text        not null,
  source     text        not null default 'landing',
  created_at timestamptz not null default now()
);

-- Safe migrations for existing tables created before email/contact_method fields.
alter table leads add column if not exists email text;
alter table leads add column if not exists contact_method text not null default 'email';
alter table leads add column if not exists contact_details text;

create index if not exists leads_source_idx     on leads (source);
create index if not exists leads_created_at_idx on leads (created_at desc);

-- Row Level Security — enable so the public internet can't read your leads
alter table leads enable row level security;

-- Only the service_role key (used server-side in our API) can access the table
create policy "service_role full access"
  on leads
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
