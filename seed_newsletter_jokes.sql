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
  ('A customer asked for my ''best and final.'' So did the next three reps he called right after.', 'sales', 0, true),
  ('They say money can''t buy happiness. Clearly they''ve never hit quota on the last day of the month.', 'quota', 0, true),
  ('I got into sales for the flexible schedule. Turns out I can work any 12 hours I want.', 'motivation', 0, true),
  ('Sales is the only profession where ''No'' just means ''Call me again next Tuesday.''', 'cold calls', 0, true),
  ('I don''t chase people. I professionally follow up... 17 times.', 'follow-up', 0, true),
  ('My paycheck has a split personality: one half is dependable, the other half has performance anxiety.', 'commission', 0, true),
  ('Every salesperson has two voices: ''I respect your decision,'' and ''I''ll circle back next quarter.''', 'sales', 0, true),
  ('My therapist says I should stop taking rejection personally. My commission plan disagrees.', 'commission', 0, true),
  ('Sales isn''t about convincing people to buy. It''s about convincing yourself the next call will be ''the one.''', 'motivation', 0, true),
  ('Coffee gets me through the morning. Commission gets me through the month.', 'commission', 0, true),
  ('I don''t have a gambling problem—I just believe every next call is a winner.', 'cold calls', 0, true),
  ('The difference between most people and a salesperson? We hear ''no'' before 9 a.m. and still smile at 9:01.', 'motivation', 0, true),
  ('A good salesperson can turn coffee into conversations. A great salesperson turns conversations into commission.', 'commission', 0, true),
  ('Sales is simple: make 100 calls so you can tell everyone about the 3 people who answered.', 'cold calls', 0, true),
  ('Everyone wants uncapped commission until they discover it comes with uncapped rejection.', 'commission', 0, true),
  ('Find a job you love, and you''ll never work a day in your life. Become a salesperson, and every ''no'' just funds the story behind your next ''yes.''', 'motivation', 0, true);
