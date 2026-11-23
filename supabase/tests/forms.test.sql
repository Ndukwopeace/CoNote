-- D126: lecturer assessments built like a Google Form. Lecturer names come from the timetable import;
-- anyone with a form's link can answer it without an account; only administrators build forms and read answers.
begin;
select tests.seed();

\set admin '''00000000-0000-0000-0000-0000000000a1'''
\set t1 '''00000000-0000-0000-0000-0000000000b1'''
\set s1 '''00000000-0000-0000-0000-0000000000c1'''
\set c1 '''00000000-0000-0000-0000-00000000c001'''
\set c3 '''00000000-0000-0000-0000-00000000c003'''

-- ===== Lecturer names from the timetable =====
select $json${
  "timezone": "Africa/Douala", "programmes": [],
  "courses": [{"code": "MTH 202", "title": "Linear Algebra", "teacherId": null,
               "lecturers": ["Dr. B. Jones", " Dr. A. Smith ", "Dr. A. Smith", ""], "sessions": []}]
}$json$::jsonb as payload \gset
select tests.login(:admin);
select public.import_timetable(:'payload'::jsonb, false);
select tests.is((select lecturers from public.courses where code = 'MTH 202'), array['Dr. A. Smith', 'Dr. B. Jones'], 'the import stores the names, trimmed, once each, in order');
select tests.fails_with('select public.import_timetable(''{"timezone":"Africa/Douala","programmes":[],"courses":[{"code":"MTH 202","title":"x","lecturers":["a","b","c","d","e","f","g","h","i","j","k"],"sessions":[]}]}''::jsonb, false)', '22023', 'more than ten lecturers is refused');
select tests.fails_with('select public.import_timetable((''{"timezone":"Africa/Douala","programmes":[],"courses":[{"code":"MTH 202","title":"x","lecturers":["'' || repeat(''x'', 101) || ''"],"sessions":[]}]}'')::jsonb, false)', '22023', 'a name over 100 characters is refused');
-- A timetable that names nobody leaves the names alone.
select public.import_timetable('{"timezone":"Africa/Douala","programmes":[],"courses":[{"code":"MTH 202","title":"x","sessions":[]}]}'::jsonb, false);
select tests.is((select cardinality(lecturers) from public.courses where code = 'MTH 202'), 2, 'a course the timetable names nobody for keeps its lecturers');
select tests.reset();

-- ===== Building a form =====
select tests.login(:admin);
select public.admin_save_form($json${
  "title": "Lecturer assessment", "description": "Rate one course at a time.", "accepting": false,
  "questions": [
    {"kind": "lecturer", "prompt": "Course and lecturer", "required": true},
    {"kind": "rating", "prompt": "Explains clearly", "required": true},
    {"kind": "rating", "prompt": "Is prepared", "required": false},
    {"kind": "paragraph", "prompt": "What could improve?", "required": false},
    {"kind": "choice", "prompt": "Starts on time?", "required": false, "options": ["Always", "Sometimes", "Never"]}
  ]
}$json$::jsonb) as form_id \gset
select tests.reset();
select token as tok from public.forms where id = :'form_id' \gset
select id as q_lec from public.form_questions where form_id = :'form_id' and kind = 'lecturer' \gset
select id as q_r1 from public.form_questions where form_id = :'form_id' and prompt = 'Explains clearly' \gset
select id as q_r2 from public.form_questions where form_id = :'form_id' and prompt = 'Is prepared' \gset
select id as q_text from public.form_questions where form_id = :'form_id' and kind = 'paragraph' \gset
select id as q_choice from public.form_questions where form_id = :'form_id' and kind = 'choice' \gset
select tests.is((select count(*) from public.form_questions where form_id = :'form_id'), 5::bigint, 'the form has its five questions');
select tests.is((select length(:'tok')), 32, 'the link holds a long random token');

select tests.login(:admin);
select tests.fails_with('select public.admin_save_form(''{"title":"","questions":[]}''::jsonb)', '22023', 'a form needs a title');
select tests.fails_with('select public.admin_save_form(''{"title":"x","questions":[{"kind":"rating","prompt":""}]}''::jsonb)', '22023', 'a question needs text');
select tests.fails_with('select public.admin_save_form(''{"title":"x","questions":[{"kind":"choice","prompt":"p","options":["only one"]}]}''::jsonb)', '22023', 'a choice question needs two choices');
select tests.fails_with('select public.admin_save_form(''{"title":"x","questions":[{"kind":"choice","prompt":"p","options":["same","same"]}]}''::jsonb)', '22023', 'choices must differ');
select tests.fails_with('select public.admin_save_form(''{"title":"x","questions":[{"kind":"banana","prompt":"p"}]}''::jsonb)', '22023', 'an unknown kind of question is refused');
select tests.fails_with('select public.admin_save_form(''{"title":"x","questions":[{"kind":"lecturer","prompt":"a"},{"kind":"lecturer","prompt":"b"}]}''::jsonb)', '22023', 'only one course and lecturer question');
select tests.fails_with('select public.admin_save_form(''{"title":"x","opensAt":"2030-01-02T00:00:00Z","closesAt":"2030-01-01T00:00:00Z","questions":[]}''::jsonb)', '22023', 'a form cannot close before it opens');
select tests.fails_with('select public.admin_save_form(''{"id":"00000000-0000-0000-0000-00000000dead","title":"x","questions":[]}''::jsonb)', 'P0002', 'an unknown form is not found');
select tests.rows('select * from public.admin_list_forms()', 1, 'the list holds the one form');
select tests.is((select (public.admin_get_form(:'form_id'::uuid) -> 'questions' -> 0 ->> 'kind')), 'lecturer', 'the first question is the lecturer one, in order');
select tests.is((select jsonb_array_length(public.admin_get_form(:'form_id'::uuid) -> 'lecturers')), 2, 'the preview offers the two lecturers');
select tests.reset();

-- ===== A visitor reads the form =====
select tests.anonymous();
select tests.is((select public.public_form(:'tok') ->> 'state'), 'closed', 'a new form is closed');
select tests.is((select jsonb_array_length(public.public_form(:'tok') -> 'questions')), 0, 'and shows no questions');
select tests.fails_with('select public.public_form(''nope'')', 'P0002', 'an unknown link is not found');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ''{}''::jsonb)', '55000', 'a closed form takes no answers');
select tests.reset();

update public.forms set accepting = true where id = :'form_id';
select tests.anonymous();
select tests.is((select public.public_form(:'tok') ->> 'state'), 'open', 'an open form says so');
select tests.is((select jsonb_array_length(public.public_form(:'tok') -> 'questions')), 5, 'and shows its questions');
select tests.is((select jsonb_array_length(public.public_form(:'tok') -> 'lecturers')), 2, 'and the lecturers the timetable names');
select tests.is((select (public.public_form(:'tok') -> 'questions' -> 0 ->> 'prompt')), 'Course and lecturer', 'in order');
select tests.reset();

-- ===== Answering =====
select jsonb_build_object(:'q_lec', jsonb_build_object('courseId', :c1::uuid, 'lecturer', 'Dr. A. Smith'),
                          :'q_r1', 5, :'q_r2', 4, :'q_text', 'Clear lessons', :'q_choice', 'Always') as good \gset
select tests.anonymous();
select tests.affects('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal(:'good') || '::jsonb)', 1, 'a visitor sends an answer');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ''[]''::jsonb)', '22023', 'answers must be an object');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal(jsonb_build_object(:'q_r1', 4)::text) || '::jsonb)', '22023', 'the required lecturer question must be answered');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || '{"00000000-0000-0000-0000-00000000dead": "x"}'::jsonb)::text) || '::jsonb)', '22023', 'an answer to a question the form does not ask is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_r1', 6))::text) || '::jsonb)', '22023', 'a rating of 6 is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_r1', 0))::text) || '::jsonb)', '22023', 'a rating of 0 is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_r1', 4.5))::text) || '::jsonb)', '22023', 'a rating with a fraction is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_r1', '5'::text))::text) || '::jsonb)', '22023', 'a rating sent as text is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_choice', 'Maybe'))::text) || '::jsonb)', '22023', 'a choice that is not on offer is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_text', repeat('x', 2001)))::text) || '::jsonb)', '22023', 'a comment over 2000 characters is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_lec', jsonb_build_object('courseId', :c1::uuid, 'lecturer', 'Dr. Nobody')))::text) || '::jsonb)', '22023', 'a lecturer the timetable does not name is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_lec', jsonb_build_object('courseId', :c3::uuid, 'lecturer', 'Dr. A. Smith')))::text) || '::jsonb)', '22023', 'a lecturer on a course that does not name them is refused');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal((:'good'::jsonb || jsonb_build_object(:'q_lec', 'not an object'))::text) || '::jsonb)', '22023', 'a lecturer answer must be an object');
select tests.reset();
-- A second answer, rating the same lecturer lower, and one for the other lecturer.
select tests.anonymous();
select public.submit_form_response(:'tok', (:'good'::jsonb || jsonb_build_object(:'q_r1', 3, :'q_r2', 2)));
select public.submit_form_response(:'tok', (:'good'::jsonb || jsonb_build_object(:'q_lec', jsonb_build_object('courseId', :c1::uuid, 'lecturer', 'Dr. B. Jones'), :'q_r1', 1)));
select tests.reset();
select tests.is((select count(*) from public.form_responses where form_id = :'form_id'), 3::bigint, 'three answers are stored');
select tests.is((select count(*) from public.form_responses where form_id = :'form_id' and course_code = 'MTH 202'), 3::bigint, 'each with its course');
select tests.is((select answers ? :'q_lec' from public.form_responses where form_id = :'form_id' limit 1), false, 'the lecturer is in its own columns, not in the answers');
select tests.is((select count(*) from information_schema.columns where table_name = 'form_responses' and column_name in ('user_id', 'email', 'ip', 'session_id', 'name')), 0::bigint, 'nothing about the sender has a column');

-- ===== Closing it, and dates =====
update public.forms set closes_at = now() - interval '1 minute' where id = :'form_id';
select tests.anonymous();
select tests.is((select public.public_form(:'tok') ->> 'state'), 'closed', 'a form past its closing date is closed');
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal(:'good') || '::jsonb)', '55000', 'and takes no more answers');
select tests.reset();
update public.forms set closes_at = null, opens_at = now() + interval '1 day' where id = :'form_id';
select tests.anonymous();
select tests.is((select public.public_form(:'tok') ->> 'state'), 'not_open', 'a form that opens later says so');
select tests.reset();
update public.forms set opens_at = null where id = :'form_id';

-- ===== Reading the results =====
select tests.login(:admin);
select tests.is((select response_count from public.admin_list_forms() limit 1), 3::bigint, 'the list counts the answers');
select tests.rows('select * from public.admin_form_summary(' || quote_literal(:'form_id') || ')', 2, 'two groups: one per lecturer');
select tests.is((select (averages ->> :'q_r1')::numeric from public.admin_form_summary(:'form_id'::uuid) where lecturer = 'Dr. A. Smith'), 4.00::numeric, 'the average rating for Dr. Smith is 4 (5 and 3)');
select tests.is((select (averages ->> :'q_r2')::numeric from public.admin_form_summary(:'form_id'::uuid) where lecturer = 'Dr. A. Smith'), 3.00::numeric, 'and the second question''s is 3 (4 and 2)');
select tests.is((select responses from public.admin_form_summary(:'form_id'::uuid) where lecturer = 'Dr. B. Jones'), 1::bigint, 'one answer for Dr. Jones');
select tests.is((select (averages ->> :'q_r1')::numeric from public.admin_form_summary(:'form_id'::uuid) where lecturer = 'Dr. B. Jones'), 1.00::numeric, 'each lecturer has their own averages');
select tests.rows('select * from public.admin_form_responses(' || quote_literal(:'form_id') || ')', 3, 'the answers are listed');
select tests.rows('select * from public.admin_form_responses(' || quote_literal(:'form_id') || ', ''MTH 202'', ''Dr. B. Jones'')', 1, 'and can be narrowed to a lecturer');
select tests.is((select max(total_count) from public.admin_form_responses(:'form_id'::uuid, p_limit := 1)), 3::bigint, 'the total is reported whatever the page size');
select tests.rows('select * from public.admin_form_responses(' || quote_literal(:'form_id') || ', p_limit := 100000)', 3, 'a huge limit is capped, not an error');
select tests.is((select answers ->> :'q_text' from public.admin_form_responses(:'form_id'::uuid, 'MTH 202', 'Dr. B. Jones')), 'Clear lessons', 'the comments come through');
select tests.reset();

-- ===== Changing a form that has answers =====
select tests.login(:admin);
select tests.fails_with('select public.admin_save_form(jsonb_build_object(''id'', ' || quote_literal(:'form_id') || ', ''title'', ''x'', ''questions'', jsonb_build_array(jsonb_build_object(''id'', ' || quote_literal(:'q_lec') || ', ''kind'', ''lecturer'', ''prompt'', ''x''))))', '22023', 'a question with answers cannot be removed');
select tests.fails_with('select public.admin_save_form(' || quote_literal(public.admin_get_form(:'form_id'::uuid)::text) || '::jsonb #- ''{questions,1,options}'' || jsonb_build_object(''questions'', jsonb_build_array(jsonb_build_object(''id'', ' || quote_literal(:'q_r1') || ', ''kind'', ''paragraph'', ''prompt'', ''x'')) || (select jsonb_agg(q) from jsonb_array_elements(public.admin_get_form(' || quote_literal(:'form_id') || '::uuid) -> ''questions'') q where q ->> ''id'' <> ' || quote_literal(:'q_r1') || ')))', '22023', 'an answered question keeps its kind');
-- Rewording, and adding a question, are fine.
select public.admin_save_form(
  jsonb_set(public.admin_get_form(:'form_id'::uuid), '{questions}',
    (public.admin_get_form(:'form_id'::uuid) -> 'questions') || '[{"kind":"short","prompt":"Anything else?","required":false}]'::jsonb));
select tests.reset();
select tests.is((select count(*) from public.form_questions where form_id = :'form_id'), 6::bigint, 'a question can be added after answers arrive');

-- ===== Only administrators =====
select tests.login(:s1);
select tests.denied('select * from public.forms', 'a student cannot read the forms table');
select tests.denied('select * from public.form_responses', 'or the answers');
select tests.fails_with('select * from public.admin_list_forms()', '42501', 'a student cannot list forms');
select tests.fails_with('select public.admin_save_form(''{"title":"x","questions":[]}''::jsonb)', '42501', 'or build one');
select tests.fails_with('select * from public.admin_form_responses(' || quote_literal(:'form_id') || ')', '42501', 'or read answers');
select tests.reset();
select tests.login(:t1);
select tests.fails_with('select * from public.admin_form_summary(' || quote_literal(:'form_id') || ')', '42501', 'a teacher cannot read the results');
select tests.fails_with('select public.admin_delete_form(' || quote_literal(:'form_id') || ')', '42501', 'or delete a form');
select tests.reset();
select tests.anonymous();
select tests.denied('select * from public.forms', 'a visitor cannot read the forms table');
select tests.denied('select * from public.form_responses', 'or the answers');
select tests.denied('select * from public.admin_list_forms()', 'or list forms');
select tests.denied('select public.admin_save_form(''{"title":"x","questions":[]}''::jsonb)', 'or build one');
select tests.denied('select * from public.admin_form_responses(' || quote_literal(:'form_id') || ')', 'or read answers');
select tests.denied('select * from public.admin_form_summary(' || quote_literal(:'form_id') || ')', 'or the results');
select tests.reset();

-- ===== Flooding =====
update public.forms set closes_at = null where id = :'form_id';
insert into public.form_responses (form_id, answers) select :'form_id', '{}'::jsonb from generate_series(1, 600);
select tests.anonymous();
select tests.fails_with('select public.submit_form_response(' || quote_literal(:'tok') || ', ' || quote_literal(:'good') || '::jsonb)', '54000', 'a form takes at most 600 answers a minute');
select tests.reset();
delete from public.form_responses where form_id = :'form_id' and course_code is null;

-- ===== Deleting =====
select tests.login(:admin);
select tests.affects('select public.admin_delete_form_response((select id from public.admin_form_responses(' || quote_literal(:'form_id') || ') limit 1))', 1, 'an administrator deletes an answer');
select tests.fails_with('select public.admin_delete_form_response(''00000000-0000-0000-0000-00000000dead'')', 'P0002', 'an unknown answer is not found');
select tests.affects('select public.admin_delete_form(' || quote_literal(:'form_id') || ')', 1, 'and a form');
select tests.reset();
select tests.rows('select * from public.form_questions where form_id = ' || quote_literal(:'form_id'), 0, 'with its questions');
select tests.rows('select * from public.form_responses where form_id = ' || quote_literal(:'form_id'), 0, 'and its answers');
select tests.is((select count(*) from public.audit_logs where action in ('form.saved', 'form.deleted', 'form.response_deleted')) >= 4, true, 'building and deleting are in the audit log');

rollback;
