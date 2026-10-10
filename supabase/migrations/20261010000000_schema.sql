-- CoNote shared schema (milestone B1; student REQUIREMENTS 12.2, admin REQUIREMENTS 6).
-- One database serves the student, teacher and admin apps. Row Level Security is in the next
-- migration; this one only creates the types and tables.

-- Helper functions live in a schema the API does not expose, so a browser can never call them.
create schema if not exists app;

-- ---------------------------------------------------------------------------------------------
-- Types. Spelled exactly as @conote/domain spells them.
-- ---------------------------------------------------------------------------------------------

-- Who a person is. Only an administrator (through a server function) can change it.
create type public.user_role as enum ('student', 'teacher', 'admin');
-- Whether an account may sign in. 'pending' means invited and not yet signed in.
create type public.account_status as enum ('active', 'inactive', 'suspended', 'pending');
-- Where a course is in its term.
create type public.course_status as enum ('upcoming', 'ongoing', 'completed');
-- The summary pipeline's stages, in order. 'failed' comes from the latest AI job.
create type public.summary_status as enum ('collecting', 'processing', 'in_review', 'published', 'failed');
-- A student's request to join a course (D76).
create type public.request_status as enum ('pending', 'approved', 'declined', 'cancelled');
-- What a resource is, and whether students can see it.
create type public.resource_type as enum ('pdf', 'document', 'slides', 'video', 'link');
create type public.resource_status as enum ('draft', 'published', 'archived');
-- AI job kinds and stages.
create type public.ai_job_kind as enum ('summary', 'regenerate');
create type public.ai_job_status as enum ('queued', 'running', 'succeeded', 'failed');
-- Notification kinds.
create type public.notification_type as enum ('summary', 'system', 'message', 'note');
-- What the analytics count.
create type public.activity_kind as enum ('sign_in', 'note_created', 'summary_viewed', 'resource_opened', 'ai_question');

-- ---------------------------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------------------------

-- One row per account, created by a trigger when Supabase Auth creates the user.
create table public.profiles (
  -- The same ID as auth.users, so a deleted login removes the profile.
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  status public.account_status not null default 'active',
  full_name text not null default '',
  email text not null,
  avatar_url text,
  department text,
  level text,
  phone text,
  -- Human-readable IDs, separate from the internal one.
  student_number text unique,
  staff_number text unique,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Courses, enrolment and classes
-- ---------------------------------------------------------------------------------------------

-- A course has one teacher. Archived courses are hidden from students and teachers, never deleted.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  department text,
  teacher_id uuid references public.profiles (id) on delete set null,
  status public.course_status not null default 'upcoming',
  schedule_text text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Who is in which course. Rows are added by an administrator, directly or by approving a request.
create table public.enrollments (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

-- The UI says "Class"; the table is class_sessions.
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  number integer not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Kept in step with summaries.status by a trigger.
  summary_status public.summary_status not null default 'collecting',
  archived_at timestamptz,
  unique (course_id, number),
  -- A class cannot end before it starts.
  check (ends_at > starts_at),
  -- Lets notes and summaries point at a class AND its course without the two disagreeing.
  unique (id, course_id)
);

-- A student's request to join a course (D76). At most one pending request per student and course.
create table public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
-- The "one pending request" rule.
create unique index enrollment_requests_one_pending
  on public.enrollment_requests (course_id, student_id) where status = 'pending';

-- ---------------------------------------------------------------------------------------------
-- Notes and summaries
-- ---------------------------------------------------------------------------------------------

-- Private to the author. Nobody else reads them through the API, administrators included.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  class_id uuid not null,
  title text,
  content_html text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The class must belong to the course named on the note.
  foreign key (class_id, course_id) references public.class_sessions (id, course_id) on delete cascade
);

-- One summary per class. Students only ever read the published ones.
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique,
  course_id uuid not null,
  status public.summary_status not null default 'collecting',
  overview text not null default '',
  key_concepts jsonb not null default '[]'::jsonb,
  confusion_areas jsonb not null default '[]'::jsonb,
  key_topics jsonb not null default '[]'::jsonb,
  notes_analyzed_count integer not null default 0,
  students_analyzed_count integer not null default 0,
  -- Bumped on every edit, so a stale save is refused (teacher REQUIREMENTS section 9).
  version integer not null default 1,
  in_review_since timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  foreign key (class_id, course_id) references public.class_sessions (id, course_id) on delete cascade
);

-- Which student has opened which published summary ("viewed by me").
create table public.summary_views (
  summary_id uuid not null references public.summaries (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (summary_id, student_id)
);

-- ---------------------------------------------------------------------------------------------
-- Notifications and resources
-- ---------------------------------------------------------------------------------------------

-- Written by the server; a user reads their own and marks them read.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null default '',
  link text,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

-- Course material uploaded by an administrator.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  type public.resource_type not null,
  -- A file in Storage, or an outside link; one of the two.
  storage_path text,
  url text,
  course_id uuid not null references public.courses (id) on delete cascade,
  class_id uuid references public.class_sessions (id) on delete set null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  status public.resource_status not null default 'draft',
  created_at timestamptz not null default now(),
  check ((storage_path is null) <> (url is null))
);

-- ---------------------------------------------------------------------------------------------
-- Operations: written by the server only
-- ---------------------------------------------------------------------------------------------

-- One run of the summary pipeline for a class.
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_sessions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  kind public.ai_job_kind not null default 'summary',
  status public.ai_job_status not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  -- Safe text only; never a stack trace or note content.
  error_message text,
  attempt integer not null default 1
);

-- Append-only record of who did what. Written by triggers and server functions.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  course_id uuid,
  class_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

-- What the analytics count. Never holds note content.
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind public.activity_kind not null,
  course_id uuid,
  class_id uuid,
  created_at timestamptz not null default now()
);

-- One row of non-secret settings (admin REQUIREMENTS section 19). The check allows only one row.
create table public.platform_settings (
  id boolean primary key default true check (id),
  term_starts_on date,
  term_ends_on date,
  review_alert_days integer not null default 3 check (review_alert_days > 0)
);
-- The one row.
insert into public.platform_settings default values;

-- ---------------------------------------------------------------------------------------------
-- Indexes for the lookups the apps make most
-- ---------------------------------------------------------------------------------------------

create index courses_teacher_idx on public.courses (teacher_id);
create index enrollments_student_idx on public.enrollments (student_id);
create index class_sessions_course_idx on public.class_sessions (course_id);
create index notes_student_class_idx on public.notes (student_id, class_id);
create index notes_class_idx on public.notes (class_id);
create index summaries_course_idx on public.summaries (course_id);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index resources_course_idx on public.resources (course_id);
create index ai_jobs_class_idx on public.ai_jobs (class_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index activity_events_created_idx on public.activity_events (created_at desc);
create index enrollment_requests_student_idx on public.enrollment_requests (student_id);
