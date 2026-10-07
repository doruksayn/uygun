create table public.poke_cooldowns (
  user_id uuid primary key references public.members(user_id) on delete cascade,
  last_poked_at timestamptz not null
);

alter table public.poke_cooldowns enable row level security;
revoke all on public.poke_cooldowns from anon, authenticated;
grant select on public.poke_cooldowns to authenticated;
grant all on public.poke_cooldowns to service_role;
create policy own_poke_cooldown on public.poke_cooldowns
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_member()));

create or replace function public.claim_poke(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz;
begin
  if not exists (select 1 from public.members where user_id = p_user_id) then
    raise exception 'Not a member';
  end if;

  insert into public.poke_cooldowns(user_id, last_poked_at)
    values (p_user_id, now())
    on conflict (user_id) do update set last_poked_at = now()
    where public.poke_cooldowns.last_poked_at <= now() - interval '15 minutes'
    returning last_poked_at into v_last;

  if found then
    return jsonb_build_object('allowed', true, 'next_available_at', v_last + interval '15 minutes');
  end if;

  select last_poked_at + interval '15 minutes' into v_last
    from public.poke_cooldowns where user_id = p_user_id;
  return jsonb_build_object('allowed', false, 'next_available_at', v_last);
end;
$$;

revoke all on function public.claim_poke(uuid) from public, anon, authenticated;
grant execute on function public.claim_poke(uuid) to service_role;
