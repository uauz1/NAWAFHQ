alter table public.hq_v2_employees add column if not exists custom_instructions text not null default '';
alter table public.hq_v2_employees add column if not exists role_source text not null default 'preset' check (role_source in ('preset','custom'));
alter table public.hq_v2_tasks add column if not exists archived_at timestamptz;

create table if not exists public.hq_v2_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department text not null default 'عام',
  description text not null default '',
  capabilities jsonb not null default '[]'::jsonb,
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_v2_task_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hq_v2_tasks(id) on delete cascade,
  author_type text not null check (author_type in ('owner','employee','system')),
  employee_id text references public.hq_v2_employees(id) on delete set null,
  content text not null check (char_length(content) between 1 and 8000),
  message_type text not null default 'discussion' check (message_type in ('discussion','revision','decision')),
  created_at timestamptz not null default now()
);
create index if not exists hq_v2_task_messages_task_created_idx on public.hq_v2_task_messages(task_id,created_at);
create index if not exists hq_v2_tasks_archived_idx on public.hq_v2_tasks(archived_at) where archived_at is null;

insert into public.hq_v2_roles(name,department,description,capabilities,is_preset) values
('مدير تنفيذي','الإدارة','تنسيق القرارات والمهام والأولويات','["general","business"]'::jsonb,true),
('مدير عمليات','العمليات','إدارة التنفيذ والمتابعة والعمليات اليومية','["general","qa"]'::jsonb,true),
('مهندس برمجيات','الهندسة','تنفيذ وإصلاح وبناء المنتجات البرمجية','["project_execution","qa"]'::jsonb,true),
('باحث ومحلل','البحث','بحث وتحليل وتوليد أفكار موثقة','["research","general"]'::jsonb,true),
('مصمم منتج وUX','المنتج والتصميم','تحسين تجربة المستخدم والواجهات','["research","design"]'::jsonb,true),
('ضمان جودة QA','الجودة','اختبار ومراجعة والتحقق من النتائج','["qa"]'::jsonb,true),
('محلل مالي ونمو','المالية والنمو','تحليل مالي ونمو وتجارب ربحية','["finance_analysis","business","paper_trade"]'::jsonb,true),
('مدير مشروع','إدارة المشاريع','تخطيط المشروع وتنسيق العمل بين الموظفين','["general","project_status"]'::jsonb,true),
('كاتب محتوى','المحتوى','صياغة المحتوى والرسائل والتوثيق','["general","research"]'::jsonb,true),
('محلل بيانات','البيانات','تحليل البيانات واستخلاص الأنماط والتوصيات','["research","general"]'::jsonb,true)
on conflict (name) do nothing;

alter table public.hq_v2_roles enable row level security;
alter table public.hq_v2_task_messages enable row level security;
grant select,insert,update,delete on table public.hq_v2_roles to anon;
grant select,insert,update,delete on table public.hq_v2_task_messages to anon;
drop policy if exists hq_v2_server_only on public.hq_v2_roles;
create policy hq_v2_server_only on public.hq_v2_roles for all to anon using ((select private.hq_v2_server_authorized())) with check ((select private.hq_v2_server_authorized()));
drop policy if exists hq_v2_server_only on public.hq_v2_task_messages;
create policy hq_v2_server_only on public.hq_v2_task_messages for all to anon using ((select private.hq_v2_server_authorized())) with check ((select private.hq_v2_server_authorized()));