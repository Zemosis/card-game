-- PIN FUNCTION SEARCH PATHS — a function resolves names through the caller's
-- search_path unless it fixes its own, so an object planted earlier on that
-- path could stand in for the one it means. Both functions use objects in
-- `public` (pg_catalog is always searched first).

alter function set_updated_at() set search_path = public;
alter function head_to_head(uuid, uuid) set search_path = public;
