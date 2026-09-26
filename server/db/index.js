// POSTGRES — the connection pool and migration runner.
// The Node server is the only client of the database; browsers reach data
// through the HTTP routes in auth.js and the socket protocol in index.js.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

export const pool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL }) : null;

if (!pool) {
  console.warn(
    "[db] DATABASE_URL not set — accounts are disabled and match results will NOT be recorded.",
  );
} else {
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
}

/** Runs fn(client) inside a transaction, rolling back on any throw. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Applies every migrations/*.sql not yet recorded in schema_migrations, in
 * filename order, each in its own transaction. Files are never edited once
 * applied — add a new numbered file instead.
 */
export async function migrate() {
  if (!pool) return;

  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const { rows } = await pool.query("select name from schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    console.log(`[db] applied migration ${file}`);
  }
}
