import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEST_DATABASE_URL, loadDb } from "./setup.js";

// Only this server may read or write the database. On Supabase, `public` is
// also reachable through its Data API, so the schema shuts every other door.
describe.skipIf(!TEST_DATABASE_URL)("database lockdown (Postgres)", () => {
  let m;
  beforeAll(async () => {
    m = await loadDb();
  });
  afterAll(() => m?.pool.end());

  it("every table in public has row level security on", async () => {
    const { rows } = await m.pool.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("no function in public is callable by everyone", async () => {
    const { rows } = await m.pool.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
         lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where n.nspname = 'public' and a.grantee = 0 and a.privilege_type = 'EXECUTE'`,
    );
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it("every function in public pins its search_path", async () => {
    const { rows } = await m.pool.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it("the server itself still reads and writes", async () => {
    await m.pool.query("truncate users, game_sessions restart identity cascade");
    await m.pool.query("insert into users (email, password_hash) values ('lock@test.dev', 'x')");
    const { rows } = await m.pool.query("select count(*)::int as n from users");
    expect(rows[0].n).toBe(1);
    await expect(m.pool.query("select * from player_stats")).resolves.toBeDefined();
  });
});
