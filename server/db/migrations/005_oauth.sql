-- SIGN IN WITH GOOGLE / DISCORD (server/oauth.js).
--
-- An account can now have no password: one made by signing in with a
-- provider. `email_verified` records whether the address was ever proven to
-- belong to the account's owner; only a provider proves it (email sign-up
-- sends no confirmation mail).
--
-- `oauth_identities` ties a provider's account to one of ours. The provider's
-- id is the key, not the email: an address can change at the provider, the id
-- never does.

alter table users alter column password_hash drop not null;
alter table users add column email_verified boolean not null default false;

create table oauth_identities (
  provider text not null check (provider in ('google', 'discord')),
  provider_user_id text not null,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, provider_user_id)
);

create index oauth_identities_user_id_idx on oauth_identities (user_id);

-- Hidden from Supabase's Data API like every other table (003_lock_down.sql).
alter table oauth_identities enable row level security;
