create or replace function public.change_status(p_user_id uuid, p_available boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.members%rowtype;
begin
  if p_available is null then raise exception 'Invalid status'; end if;
  select * into m from public.members where user_id=p_user_id for update;
  if not found then raise exception 'Not a member'; end if;
  if m.available = p_available then return jsonb_build_object('changed',false,'notify',false); end if;
  update public.members set available=p_available,updated_at=now(),last_notified_at=now() where user_id=p_user_id;
  return jsonb_build_object('changed',true,'notify',true,'name',m.display_name);
end;
$$;
