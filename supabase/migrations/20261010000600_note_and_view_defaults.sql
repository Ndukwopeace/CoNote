-- What the student portal needs to write notes and record summary views (B2.3).

-- The author of a note and the student who viewed a summary are whoever is signed in. Without a
-- default the browser would have to send its own ID. The insert policies still check that the ID
-- equals auth.uid(), so sending someone else's is refused.
alter table public.notes alter column student_id set default auth.uid();
alter table public.summary_views alter column student_id set default auth.uid();

-- Size limits, enforced by the database as well as by the app. SECURITY: the app limits a note to
-- 20,000 characters of text, but a request that skips the app could store far more and fill the
-- database or slow every list. The HTML limit is wider than the text limit because markup adds
-- characters.
alter table public.notes
  add constraint notes_content_size check (char_length(content_html) <= 200000),
  add constraint notes_tag_count check (cardinality(tags) <= 10),
  add constraint notes_title_size check (title is null or char_length(title) <= 120);
