-- Input limits the database enforces itself (security hardening).
--
-- The app limits a note to 10 tags of 30 characters, and keeps a picture address short. The
-- database already refused more than 10 tags and any picture address that is not https, but not
-- a tag or an address of any length: a request that skips the app could store a single tag or
-- address of many megabytes, which every list of notes or profiles would then have to carry.
-- These two limits close that. Neither changes what the app can do: the app's own limits are
-- inside them, and no existing row is near them.

-- All the tags of a note together may not pass the app's own limit (10 tags x 30 characters).
-- A check cannot look at each tag on its own, so the total is limited; with at most 10 tags
-- (notes_tag_count) no single tag can be longer than the total either.
alter table public.notes
  add constraint notes_tag_size check (char_length(array_to_string(tags, '')) <= 300);

-- A picture address is a link, not data: 500 characters is far more than any real one.
alter table public.profiles
  add constraint profiles_avatar_url_size check (avatar_url is null or char_length(avatar_url) <= 500);
