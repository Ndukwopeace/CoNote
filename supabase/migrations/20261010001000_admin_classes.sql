-- What the admin console's class screens need from the database (milestone B2.6b, D85): the class
-- list with its figures, and a creation time on AI jobs for the summary timeline.

-- ---------------------------------------------------------------------------------------------
-- A job's creation time. The timeline shows when processing began, which is when the first job was
-- queued. Existing rows take the time of this migration.
-- ---------------------------------------------------------------------------------------------

alter table public.ai_jobs add column created_at timestamptz not null default now();
create index ai_jobs_class_created_idx on public.ai_jobs (class_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- The class list: each class with its course, the course's teacher, the summary's stage and times
-- (never its text) and two counts. Notes are counted, never read. Like the other views it runs
-- with the owner's rights, so it filters on the caller itself: only an administrator sees any row.
-- ---------------------------------------------------------------------------------------------

create view public.admin_classes with (security_barrier = true) as
  select k.id, k.number, k.course_id, c.code as course_code, c.title as course_title,
         k.title, coalesce(k.description, '') as description, k.starts_at, k.ends_at, k.archived_at,
         c.teacher_id, t.full_name as teacher_name,
         -- Null until the class has a summary.
         s.status as summary_status, s.in_review_since, s.published_at,
         (select count(*) from public.notes n where n.class_id = k.id)::integer as note_count,
         (select count(*) from public.enrollments e where e.course_id = k.course_id)::integer as student_count
  from public.class_sessions k
  join public.courses c on c.id = k.course_id
  left join public.profiles t on t.id = c.teacher_id
  left join public.summaries s on s.class_id = k.id
  where app.is_admin();
revoke all on public.admin_classes from public, anon;
grant select on public.admin_classes to authenticated;
