create table if not exists public.hq_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.hq_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
