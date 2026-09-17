create table if not exists public.hq_v2_tool_recommendations (
  id uuid primary key default gen_random_uuid(),
  employee_id text references public.hq_v2_employees(id) on delete set null,
  provider text not null,
  capability text not null default '',
  reason text not null,
  requested_for text not null default '',
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  status text not null default 'SUGGESTED' check (status in ('SUGGESTED','CONNECTED','DISMISSED')),
  source_task_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_v2_background_routines (
  id text primary key,
  name text not null,
  description text not null default '',
  employee_id text references public.hq_v2_employees(id) on delete set null,
  project_id text references public.hq_v2_projects(id) on delete set null,
  enabled boolean not null default true,
  cadence_minutes integer not null default 60 check (cadence_minutes between 15 and 10080),
  command_template text not null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.hq_v2_background_routines(id,name,description,employee_id,project_id,enabled,cadence_minutes,command_template,next_run_at) values
('mueen-health','متابعة مُعِين','فحص دوري للمستودع والنسخة المنشورة وإظهار أي مشكلة مثبتة.','fahad','mueen',true,180,'فهد راجع مُعِين وتأكد من آخر Commit والنسخة المنشورة، ولا تدّع أي نجاح بدون دليل.',now()),
('qaddha-health','متابعة قدّها','فحص دوري للمستودع والنسخة المنشورة وإظهار أي مشكلة مثبتة.','fahad','qaddha',true,180,'فهد راجع قدّها وتأكد من آخر Commit والنسخة المنشورة، ولا تدّع أي نجاح بدون دليل.',now()),
('executive-review','مراجعة المدير العام','تلخيص ما يحتاج قرار نواف من المهام والموافقات والاتصالات.','sara',null,true,120,'سارة راجعي حالة الشركة الحالية وحددي فقط الأشياء التي تحتاج قرار نواف أو تدخل منه.',now())
on conflict (id) do nothing;

alter table public.hq_v2_tool_recommendations enable row level security;
alter table public.hq_v2_background_routines enable row level security;
grant select,insert,update,delete on table public.hq_v2_tool_recommendations to anon;
grant select,insert,update,delete on table public.hq_v2_background_routines to anon;
drop policy if exists hq_v2_server_only on public.hq_v2_tool_recommendations;
create policy hq_v2_server_only on public.hq_v2_tool_recommendations for all to anon using ((select private.hq_v2_server_authorized())) with check ((select private.hq_v2_server_authorized()));
drop policy if exists hq_v2_server_only on public.hq_v2_background_routines;
create policy hq_v2_server_only on public.hq_v2_background_routines for all to anon using ((select private.hq_v2_server_authorized())) with check ((select private.hq_v2_server_authorized()));

alter publication supabase_realtime add table public.hq_v2_tool_recommendations;
alter publication supabase_realtime add table public.hq_v2_background_routines;