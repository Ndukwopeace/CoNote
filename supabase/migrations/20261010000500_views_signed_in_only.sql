-- The five views are for signed-in people only (B2.3). Supabase grants new tables and views to the
-- 'anon' role by default, so a visitor with no sign-in could query them. Each view filters on the
-- caller and so returns no rows to a visitor, but a closed door is better than an empty room.
revoke all on
  public.course_teachers,
  public.joinable_courses,
  public.class_note_counts,
  public.summary_monitor,
  public.course_student_counts
from anon;
