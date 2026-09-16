create schema if not exists private;
revoke all on schema private from public;
create table if not exists private.hq_v2_server_keys (
  key_hash text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
revoke all on table private.hq_v2_server_keys from public, anon, authenticated;
insert into private.hq_v2_server_keys(key_hash,label) values ('3f5018ea762f1faa26c7f6926df863cdd6d617a77a33bd9c4c41b4a22312c431','render-v2') on conflict (key_hash) do nothing;

create or replace function private.hq_v2_server_authorized()
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from private.hq_v2_server_keys
    where key_hash = encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-hq-server-key',''),'sha256'),'hex')
      and revoked_at is null
  );
$$;
revoke all on function private.hq_v2_server_authorized() from public;
grant usage on schema private to anon;
grant execute on function private.hq_v2_server_authorized() to anon;

do $$ declare t text; begin
  foreach t in array array['hq_v2_employees','hq_v2_projects','hq_v2_tasks','hq_v2_task_events','hq_v2_task_evidence','hq_v2_reports','hq_v2_connection_requests','hq_v2_approvals','hq_v2_tool_connections','hq_v2_secretary_briefs','hq_v2_activity','hq_v2_settings','hq_v2_paper_accounts','hq_v2_paper_orders','hq_v2_paper_positions'] loop
    execute format('grant select, insert, update, delete on table public.%I to anon', t);
    execute format('create policy hq_v2_server_only on public.%I for all to anon using ((select private.hq_v2_server_authorized())) with check ((select private.hq_v2_server_authorized()))', t);
  end loop;
end $$;
grant usage, select on sequence public.hq_v2_task_events_id_seq to anon;
grant usage, select on sequence public.hq_v2_activity_id_seq to anon;
grant execute on function public.hq_v2_execute_paper_order(uuid,text,text,numeric,numeric,numeric,text) to anon;
