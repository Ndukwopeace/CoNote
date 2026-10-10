-- Limits on what a person can write into their own profile (B2.4). A person may edit these columns
-- directly (column grants, 20261010000100), so the database enforces the shape as well as the app.

-- SECURITY: a profile picture address must be a secure web address. Without this check a person
-- could store "javascript:..." or a plain http address, and the next screen to show their picture
-- (a teacher's, an administrator's) would load whatever it points at: a tracking pixel at best.
alter table public.profiles
  add constraint profiles_avatar_url_secure check (avatar_url is null or avatar_url ~ '^https://[^\s]+$');

-- Limits near the ones the profile form applies (name 80, department 80, level 40, phone 20; the
-- name gets a little room), so a request that skips the app cannot store megabytes in a profile.
alter table public.profiles
  add constraint profiles_full_name_size check (char_length(full_name) <= 100),
  add constraint profiles_department_size check (department is null or char_length(department) <= 80),
  add constraint profiles_level_size check (level is null or char_length(level) <= 40),
  add constraint profiles_phone_size check (phone is null or char_length(phone) <= 20);

-- Notification settings are a small JSON object, nothing else.
alter table public.profiles
  add constraint profiles_notification_prefs_shape
    check (jsonb_typeof(notification_prefs) = 'object' and octet_length(notification_prefs::text) <= 2000);
