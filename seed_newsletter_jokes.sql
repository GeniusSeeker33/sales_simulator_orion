-- Seed / refresh the Orion Insider joke library.
-- Paste this into the Supabase SQL editor and run it.
--
-- The /newsletter-admin dashboard pulls active jokes from this table
-- (least-used first) and only falls back to the hardcoded list if the
-- table can't be reached. So these are the jokes that show in the demo.
--
-- Re-running is safe: it clears the old set and reinserts a fresh one.

delete from newsletter_jokes;

insert into newsletter_jokes (joke_text, category, used_count, active) values
  ('My pipeline is like my gym membership: technically active, full of good intentions, and somehow it never converts.', 'forecasting', 0, true),
  ('Quota is the only houseguest that shows up on the 1st, judges everything you did last month, and never brings wine.', 'quota', 0, true),
  ('A prospect told me he''d ''circle back.'' That was 2019. I assume he''s still orbiting.', 'sales', 0, true),
  ('The fastest way to close a deal is a discount. The fastest way to end a career is explaining that discount to finance.', 'discounts', 0, true),
  ('Cold calling is just texting your ex, except the rejection is faster and you get to log it in a spreadsheet.', 'cold calls', 0, true),
  ('Our forecast and a fortune cookie have a lot in common: vague, oddly confident, and best taken with a grain of salt.', 'forecasting', 0, true),
  ('My manager asked where I see myself in five years. Honestly? This same call, still on hold with procurement.', 'meetings', 0, true),
  ('Wholesale is just retail for people who prefer to buy their problems in bulk.', 'wholesale', 0, true),
  ('I finally hit Inbox Zero. Then I realized I was looking at someone else''s CRM.', 'crm', 0, true),
  ('This meeting could have been an email. The email could have been a Slack. The Slack could have been nothing.', 'meetings', 0, true),
  ('They say find a job you love and you''ll never work a day in your life. I found commission, and now I work every single one of them.', 'motivation', 0, true),
  ('A customer asked for my ''best and final.'' So did the next three reps he called right after.', 'sales', 0, true);
