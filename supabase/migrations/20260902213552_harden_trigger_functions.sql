-- Follow-up to the initial schema, fixing three security advisor warnings.

-- Pin search_path. Safe here: the body only assigns NEW/OLD fields and never
-- resolves an unqualified name, and search_path does not affect current_user
-- (only SECURITY DEFINER would, and this function is deliberately INVOKER).
create or replace function public.guard_profile_stats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    new.coins := old.coins;
    new.exp := old.exp;
    new.level := old.level;
    new.wins := old.wins;
    new.games_played := old.games_played;
  end if;
  return new;
end;
$$;

-- These are trigger functions; nothing should reach them over /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_stats() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
