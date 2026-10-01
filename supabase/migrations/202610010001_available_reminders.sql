create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.claim_due_reminders()
returns table(reminder_user_id uuid, reminder_name text)
language sql security definer set search_path = '' as $$
  update public.members
  set last_notified_at = now()
  where available
    and coalesce(last_notified_at, updated_at) <= now() - interval '2 hours'
  returning user_id, display_name;
$$;

revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
