create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot smallint not null unique check (slot in (1,2)),
  display_name text not null check (char_length(display_name) between 1 and 40),
  available boolean not null default false,
  updated_at timestamptz,
  last_notified_at timestamptz
);
create table public.push_subscriptions (
  user_id uuid not null references public.members(user_id) on delete cascade,
  endpoint text not null check (char_length(endpoint) < 2048),
  subscription jsonb not null check (octet_length(subscription::text) < 4096),
  primary key(user_id,endpoint)
);
alter table public.members enable row level security;
alter table public.push_subscriptions enable row level security;
create function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()));
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
create policy members_read on public.members for select to authenticated using ((select public.is_member()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
create policy own_push on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
create function public.change_status(p_user_id uuid, p_available boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.members%rowtype; notify boolean := false;
begin
  if p_available is null then raise exception 'Invalid status'; end if;
  select * into m from public.members where user_id=p_user_id for update;
  if not found then raise exception 'Not a member'; end if;
  if m.available = p_available then return jsonb_build_object('changed',false,'notify',false); end if;
  notify := p_available and (m.last_notified_at is null or m.last_notified_at < now() - interval '60 seconds');
  update public.members set available=p_available,updated_at=now(),last_notified_at=case when notify then now() else last_notified_at end where user_id=p_user_id;
  return jsonb_build_object('changed',true,'notify',notify,'name',m.display_name);
end;
$$;
revoke all on function public.change_status(uuid,boolean) from public,anon,authenticated;
grant execute on function public.change_status(uuid,boolean) to service_role;
alter publication supabase_realtime add table public.members;
-- Default table grants may be disabled in the project setup.
grant all on public.members, public.push_subscriptions to service_role;
