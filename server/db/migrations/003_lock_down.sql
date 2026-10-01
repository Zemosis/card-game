-- LOCK DOWN — only this server reads or writes the database.
--
-- On Supabase, `public` is reachable through its Data API with the project's
-- public keys, and `users` holds emails and password hashes. Row level security
-- with no policies hides every row from those API roles, while the server's
-- role (the table owner, or Supabase's `postgres`, which bypasses RLS) is
-- untouched. Functions lose the default execute-by-everyone grant.
--
-- Supabase's API roles (`anon`, `authenticated`) also lose their grants here
-- and on anything created later. On plain Postgres those roles don't exist and
-- that part is skipped.

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke all on all functions in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
  end if;
end $$;
