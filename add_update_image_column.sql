-- Adds image support to Company Updates and Shout-Outs in the Orion Insider
-- newsletter. Run this once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query). Images are stored inline as base64 data
-- URLs in these text columns, so no Storage bucket or policies are required.

alter table newsletter_updates
  add column if not exists image_url text;

alter table newsletter_shoutouts
  add column if not exists image_url text;
