-- Run in Supabase SQL Editor after both members have been added.
-- This checks permissions with database roles and rolls back all session settings.
begin;
do $$ begin
 if (select count(*) from public.members) <> 2 then raise exception 'Exactly two members must be configured'; end if;
 if has_table_privilege('anon','public.members','SELECT') then raise exception 'Anonymous member access'; end if;
 if has_table_privilege('authenticated','public.members','UPDATE') then raise exception 'Direct status update exposed'; end if;
 if has_function_privilege('authenticated','public.change_status(uuid,boolean)','EXECUTE') then raise exception 'Privileged RPC exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select user_id::text from public.members where slot=1),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.members) <> 2 then raise exception 'Member cannot see pair'; end if;
 if exists(select 1 from public.push_subscriptions where user_id <> auth.uid()) then raise exception 'Partner push subscription exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.members) then raise exception 'Outsider can read members'; end if;
 if exists(select 1 from public.push_subscriptions) then raise exception 'Outsider can read subscriptions'; end if;
end $$;
reset role;
rollback;
select 'Access checks passed' as result;
