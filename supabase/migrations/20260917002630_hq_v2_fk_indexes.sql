-- NAWAF HQ V2 foreign-key indexes added after Supabase performance advisor review.
create index if not exists hq_v2_activity_employee_id_idx on public.hq_v2_activity(employee_id);
create index if not exists hq_v2_activity_project_id_idx on public.hq_v2_activity(project_id);
create index if not exists hq_v2_activity_task_id_idx on public.hq_v2_activity(task_id);
create index if not exists hq_v2_approvals_employee_id_idx on public.hq_v2_approvals(employee_id);
create index if not exists hq_v2_approvals_task_id_idx on public.hq_v2_approvals(task_id);
create index if not exists hq_v2_connection_requests_employee_id_idx on public.hq_v2_connection_requests(employee_id);
create index if not exists hq_v2_connection_requests_task_id_idx on public.hq_v2_connection_requests(task_id);
create index if not exists hq_v2_employees_current_task_id_idx on public.hq_v2_employees(current_task_id);
create index if not exists hq_v2_paper_orders_account_id_idx on public.hq_v2_paper_orders(account_id);
create index if not exists hq_v2_paper_orders_task_id_idx on public.hq_v2_paper_orders(task_id);
create index if not exists hq_v2_reports_author_employee_id_idx on public.hq_v2_reports(author_employee_id);
create index if not exists hq_v2_reports_project_id_idx on public.hq_v2_reports(project_id);
create index if not exists hq_v2_reports_source_task_id_idx on public.hq_v2_reports(source_task_id);
create index if not exists hq_v2_secretary_briefs_task_id_idx on public.hq_v2_secretary_briefs(task_id);
create index if not exists hq_v2_task_evidence_task_id_idx on public.hq_v2_task_evidence(task_id);
