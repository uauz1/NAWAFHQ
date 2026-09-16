create extension if not exists pgcrypto;

create type public.hq_v2_employee_status as enum ('READY','WORKING','RESEARCHING','REVIEWING','WAITING','ERROR','OFFLINE');
create type public.hq_v2_project_status as enum ('ACTIVE','PLANNED','ARCHIVED','ON_HOLD');
create type public.hq_v2_task_status as enum ('QUEUED','ROUTING','PLANNING','WORKING','RESEARCHING','REVIEWING','WAITING_FOR_CONNECTION','WAITING_FOR_APPROVAL','PAUSED_EXTERNAL','BLOCKED','COMPLETED','FAILED','CANCELLED');
create type public.hq_v2_request_status as enum ('PENDING','APPROVED','CONNECTED','DECLINED','FAILED');

create table public.hq_v2_employees (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  role text not null,
  department text not null,
  status public.hq_v2_employee_status not null default 'READY',
  expertise jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  preferred_tools jsonb not null default '[]'::jsonb,
  routing_rules jsonb not null default '{}'::jsonb,
  current_task_id uuid,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hq_v2_projects (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  status public.hq_v2_project_status not null,
  repository_url text,
  live_url text,
  owners jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_verified_commit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hq_v2_tasks (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  title text not null,
  route text not null,
  status public.hq_v2_task_status not null default 'QUEUED',
  employee_id text references public.hq_v2_employees(id),
  project_id text references public.hq_v2_projects(id),
  adapter_id text,
  plan jsonb not null default '[]'::jsonb,
  result jsonb,
  error_class text,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 3 check (max_retries between 0 and 10),
  next_retry_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.hq_v2_employees add constraint hq_v2_employees_current_task_fk foreign key (current_task_id) references public.hq_v2_tasks(id) on delete set null;

create table public.hq_v2_task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.hq_v2_tasks(id) on delete cascade,
  stage text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.hq_v2_task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hq_v2_tasks(id) on delete cascade,
  kind text not null,
  label text not null,
  uri text,
  data jsonb not null default '{}'::jsonb,
  verified_at timestamptz not null default now()
);

create table public.hq_v2_reports (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  summary text not null,
  author_employee_id text references public.hq_v2_employees(id),
  source_task_id uuid references public.hq_v2_tasks(id),
  project_id text references public.hq_v2_projects(id),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.hq_v2_connection_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hq_v2_tasks(id),
  employee_id text references public.hq_v2_employees(id),
  provider text not null,
  reason text not null,
  permissions jsonb not null default '[]'::jsonb,
  costs_money boolean not null default false,
  status public.hq_v2_request_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.hq_v2_approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hq_v2_tasks(id),
  employee_id text references public.hq_v2_employees(id),
  action text not null,
  reason text not null,
  impact text not null,
  cost numeric(14,2),
  tool_id text,
  status public.hq_v2_request_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.hq_v2_tool_connections (
  id text primary key,
  provider text not null,
  capabilities jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  connection_state text not null default 'DISCONNECTED',
  health_state text not null default 'UNAVAILABLE',
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.hq_v2_secretary_briefs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hq_v2_tasks(id),
  title text not null,
  body text not null,
  severity text not null default 'INFO',
  created_at timestamptz not null default now()
);

create table public.hq_v2_activity (
  id bigint generated always as identity primary key,
  task_id uuid references public.hq_v2_tasks(id),
  employee_id text references public.hq_v2_employees(id),
  project_id text references public.hq_v2_projects(id),
  kind text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.hq_v2_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.hq_v2_paper_accounts (
  id text primary key,
  currency text not null default 'USD',
  initial_cash numeric(18,4) not null,
  cash numeric(18,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hq_v2_paper_orders (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.hq_v2_paper_accounts(id),
  task_id uuid references public.hq_v2_tasks(id),
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  notional numeric(18,4) not null check (notional > 0),
  quantity numeric(24,8) not null check (quantity > 0),
  fill_price numeric(18,6) not null check (fill_price > 0),
  source text not null,
  status text not null default 'FILLED',
  created_at timestamptz not null default now()
);

create table public.hq_v2_paper_positions (
  account_id text not null references public.hq_v2_paper_accounts(id),
  symbol text not null,
  quantity numeric(24,8) not null,
  average_cost numeric(18,6) not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, symbol)
);

create or replace function public.hq_v2_execute_paper_order(
  p_task_id uuid, p_symbol text, p_side text, p_notional numeric, p_quantity numeric, p_price numeric, p_source text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_order_id uuid; v_cash numeric; v_qty numeric; v_cost numeric;
begin
  if p_side not in ('BUY','SELL') or p_notional <= 0 or p_quantity <= 0 or p_price <= 0 then raise exception 'INVALID_PAPER_ORDER'; end if;
  select cash into v_cash from public.hq_v2_paper_accounts where id='default' for update;
  select quantity, average_cost into v_qty, v_cost from public.hq_v2_paper_positions where account_id='default' and symbol=upper(p_symbol) for update;
  if p_side='BUY' then
    if v_cash < p_notional then raise exception 'INSUFFICIENT_PAPER_CASH'; end if;
    update public.hq_v2_paper_accounts set cash=cash-p_notional,updated_at=now() where id='default';
    insert into public.hq_v2_paper_positions(account_id,symbol,quantity,average_cost) values('default',upper(p_symbol),p_quantity,p_price)
    on conflict(account_id,symbol) do update set average_cost=((hq_v2_paper_positions.quantity*hq_v2_paper_positions.average_cost)+(p_quantity*p_price))/(hq_v2_paper_positions.quantity+p_quantity),quantity=hq_v2_paper_positions.quantity+p_quantity,updated_at=now();
  else
    if coalesce(v_qty,0) < p_quantity then raise exception 'INSUFFICIENT_PAPER_POSITION'; end if;
    update public.hq_v2_paper_accounts set cash=cash+p_notional,updated_at=now() where id='default';
    update public.hq_v2_paper_positions set quantity=quantity-p_quantity,updated_at=now() where account_id='default' and symbol=upper(p_symbol);
    delete from public.hq_v2_paper_positions where account_id='default' and symbol=upper(p_symbol) and quantity=0;
  end if;
  insert into public.hq_v2_paper_orders(account_id,task_id,symbol,side,notional,quantity,fill_price,source) values('default',p_task_id,upper(p_symbol),p_side,p_notional,p_quantity,p_price,p_source) returning id into v_order_id;
  return v_order_id;
end $$;
revoke all on function public.hq_v2_execute_paper_order(uuid,text,text,numeric,numeric,numeric,text) from public, anon, authenticated;

create index hq_v2_tasks_status_idx on public.hq_v2_tasks(status, created_at);
create index hq_v2_tasks_employee_idx on public.hq_v2_tasks(employee_id, updated_at desc);
create index hq_v2_tasks_project_idx on public.hq_v2_tasks(project_id, updated_at desc);
create index hq_v2_events_task_idx on public.hq_v2_task_events(task_id, created_at);
create index hq_v2_activity_created_idx on public.hq_v2_activity(created_at desc);
create index hq_v2_connections_status_idx on public.hq_v2_connection_requests(status, created_at);
create index hq_v2_approvals_status_idx on public.hq_v2_approvals(status, created_at);

do $$ declare t text; begin
  foreach t in array array['hq_v2_employees','hq_v2_projects','hq_v2_tasks','hq_v2_task_events','hq_v2_task_evidence','hq_v2_reports','hq_v2_connection_requests','hq_v2_approvals','hq_v2_tool_connections','hq_v2_secretary_briefs','hq_v2_activity','hq_v2_settings','hq_v2_paper_accounts','hq_v2_paper_orders','hq_v2_paper_positions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

insert into public.hq_v2_employees (id,name_ar,name_en,role,department,expertise,permissions,preferred_tools,routing_rules) values
('sara','سارة','Sara','General Manager / Executive AI','Executive','["coordination","executive_summary","delegation"]','["read_company","route_tasks"]','["secretary","research"]','{"routes":["GENERAL"]}'),
('omar','عمر','Omar','Technology & Research Lead','Technology & Research','["architecture","technical_research","investigation"]','["read_projects","research"]','["research","github"]','{"routes":["RESEARCH"]}'),
('fahad','فهد','Fahad','Software & Project Engineer','Engineering','["software","debugging","implementation","ci"]','["read_repos","write_code","run_tests"]','["github","render","vercel"]','{"routes":["PROJECT_EXECUTION"]}'),
('lian','ليان','Lian','Product & Experience Lead','Product & Design','["product","ux","design_systems"]','["read_projects","create_reports"]','["browser","research"]','{"routes":["DESIGN"]}'),
('noura','نورة','Noura','QA & Review Lead','Quality','["qa","regression","evidence_review"]','["read_repos","run_tests","review_evidence"]','["github","browser"]','{"routes":["QA"]}'),
('rakan','راكان','Rakan','Financial Analyst & Growth Lead','Finance & Growth','["finance","growth","monetization","paper_trading"]','["market_data","paper_trade"]','["market_data","paper_broker","research"]','{"routes":["BUSINESS","FINANCE_ANALYSIS","TRADING_PAPER"]}')
on conflict (id) do nothing;

insert into public.hq_v2_projects (id,name_ar,name_en,status,repository_url,live_url,owners) values
('mueen','مُعِين','Mueen','ACTIVE','https://github.com/uauz1/mueen-islamic-app','https://mueen-islamic-app.vercel.app','["fahad","lian","noura"]'),
('qaddha','قدّها','Qaddha','ACTIVE','https://github.com/uauz1/game','https://qaddha.vercel.app','["fahad","lian","noura","rakan"]'),
('nav','ناڤ','Nav','PLANNED',null,null,'["omar","lian"]')
on conflict (id) do nothing;

insert into public.hq_v2_paper_accounts (id, initial_cash, cash) values ('default',10000,10000) on conflict (id) do nothing;

alter publication supabase_realtime add table public.hq_v2_tasks;
alter publication supabase_realtime add table public.hq_v2_task_events;
alter publication supabase_realtime add table public.hq_v2_connection_requests;
alter publication supabase_realtime add table public.hq_v2_approvals;
alter publication supabase_realtime add table public.hq_v2_secretary_briefs;
