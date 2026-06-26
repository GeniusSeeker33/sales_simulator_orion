-- Shared "living draft" for the in-progress Orion Insider issue.
-- Paste this into the Supabase SQL editor and run it once.
--
-- The /newsletter-admin dashboard keeps the issue you're building (name, date,
-- new hires, birthdays, anniversaries) in this table so it follows you from one
-- computer or browser to another. There is only ever ONE draft row (id =
-- 'current'); it's overwritten as you edit and cleared when you click Generate.
--
-- Re-running is safe: "if not exists" means it won't disturb an existing draft.

create table if not exists newsletter_draft (
  id text primary key default 'current',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Match the other newsletter tables: allow the dashboard (anon key) to read and
-- write the draft.
alter table newsletter_draft enable row level security;

drop policy if exists "newsletter_draft read"  on newsletter_draft;
drop policy if exists "newsletter_draft write" on newsletter_draft;

create policy "newsletter_draft read"  on newsletter_draft
  for select using (true);
create policy "newsletter_draft write" on newsletter_draft
  for all using (true) with check (true);
