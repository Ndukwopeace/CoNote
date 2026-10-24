-- Telling people about a summary (D111).
--
-- Two moments matter. When the pipeline finishes a draft (status becomes "in_review") the teacher of
-- the course is told it is waiting. When the teacher publishes it (status becomes "published") the
-- students enrolled in the course are told it can be read.
--
-- It is one trigger on the summary's status, so every way a summary can reach those two stages
-- tells the same people, and no existing function has to be rewritten.
--
-- A notice holds words and counts only: the course code, the class number and title, and the
-- teacher's name. SECURITY: it never holds anything a student wrote, so a notice cannot leak a note
-- to the teacher, and nothing in it can run as code (the apps show it as plain text).

create function app.notify_summary_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  -- The course and class the summary belongs to.
  v_course public.courses;
  v_class public.class_sessions;
  -- Who published it, for the students' notice. Empty when the profile has no name.
  v_teacher_name text;
begin
  select * into v_course from public.courses where id = new.course_id;
  select * into v_class from public.class_sessions where id = new.class_id;

  if new.status = 'in_review' then
    -- A draft is ready. A course without a teacher has nobody to tell; the draft is still kept.
    if v_course.teacher_id is not null then
      insert into public.notifications (user_id, type, title, body, link)
        values (
          v_course.teacher_id, 'summary', 'A draft is ready to review',
          format('%s, class %s: %s', v_course.code, v_class.number, v_class.title),
          '/teacher/reviews/' || new.id);
    end if;
  elsif new.status = 'published' then
    -- The reviewer's name, trimmed; blank becomes "Your teacher" below.
    select nullif(btrim(p.full_name), '') into v_teacher_name from public.profiles p where p.id = new.reviewed_by;
    -- Every student enrolled in the course is told, and nobody else.
    insert into public.notifications (user_id, type, title, body, link)
      select e.student_id, 'summary', 'Summary published',
             format('%s published the summary for %s, class %s.',
               coalesce(v_teacher_name, 'Your teacher'), v_course.code, v_class.number),
             format('/courses/%s/classes/%s/summary', new.course_id, new.class_id)
        from public.enrollments e
        where e.course_id = new.course_id;
  end if;
  -- An AFTER trigger's return value is ignored.
  return null;
end
$$;

-- Only a status that has just changed to one of the two stages can tell anyone. A save that leaves
-- the stage alone, a failed job, and the rows the fixtures and the seed insert directly do not.
create trigger summaries_notify
  after update of status on public.summaries
  for each row
  when (old.status is distinct from new.status and new.status in ('in_review', 'published'))
  execute function app.notify_summary_change();

-- SECURITY: the function runs with the table owner's rights so it can write notices, which no
-- signed-in user may do directly. Nobody can call it by hand: it is a trigger function, and its
-- execute right is taken from everyone.
revoke all on function app.notify_summary_change() from public, anon, authenticated;
