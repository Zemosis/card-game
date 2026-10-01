// SIGN IN WITH GOOGLE / DISCORD — the OAuth 2.0 authorization-code flow, run
// entirely by this server. No third-party auth service is involved: a
// provider only vouches for who the player is, and the player gets the same
// session token an email sign-in gives (auth.js).
//
//   1. GET /api/auth/oauth/:provider       the site sends the player here; we
//      remember a random `state` and a PKCE verifier in a short-lived cookie
//      and redirect to the provider's consent screen.
//   2. GET /api/auth/oauth/:provider/callback   the provider sends them back
//      with a one-time code. The state must match the cookie (so nobody can
//      sign you into their account by sending you a link), then we trade the
//      code for the player's provider id and verified email.
//   3. We find or make the account and redirect to the site's /auth/callback
//      with the session token in the URL fragment (fragments never reach a
//      server or its logs). Failures land there too, as #error=<reason>.
//
// Accounts: a provider identity, once seen, always signs into the same
// account. A new one joins the account that already has its verified email.
// Email sign-up never proves the address, so when a provider does, any
// password set before that is dropped: whoever chose it may not have owned
// the address. Otherwise a new account is made, profile and all.
//
// A provider shows up in /providers only when its client id and secret are
// set (GOOGLE_CLIENT_ID / _SECRET, DISCORD_CLIENT_ID / _SECRET).

import crypto from "node:crypto";
import express from "express";
import { pool, withTransaction } from "./db/index.js";
import { signToken } from "./auth.js";

const COOKIE = "khuzur_oauth";
const COOKIE_TTL_MS = 10 * 60 * 1000;

const PROVIDERS = {
  google: {
    env: "GOOGLE",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "openid email",
    // Let players with several Google accounts pick one.
    extra: { prompt: "select_account" },
    async identity(accessToken) {
      const me = await getJson("https://openidconnect.googleapis.com/v1/userinfo", accessToken);
      return { id: String(me.sub), email: me.email, emailVerified: me.email_verified === true };
    },
  },
  discord: {
    env: "DISCORD",
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    scope: "identify email",
    // Skip the consent screen for players who already allowed us.
    extra: { prompt: "none" },
    async identity(accessToken) {
      const me = await getJson("https://discord.com/api/users/@me", accessToken);
      return { id: String(me.id), email: me.email, emailVerified: me.verified === true };
    },
  },
};

// Read at request time, so a deploy (or a test) can set them after import.
const credentials = (name) => {
  const env = PROVIDERS[name].env;
  const id = process.env[`${env}_CLIENT_ID`];
  const secret = process.env[`${env}_CLIENT_SECRET`];
  return id && secret ? { id, secret } : null;
};

/** This server's public address: where providers send players back. */
function serverUrl() {
  return (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, "");
}

/** The website's address: SITE_URL, else the first CORS origin. */
function siteUrl() {
  const first = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim();
  return (process.env.SITE_URL || first).replace(/\/$/, "");
}

const callbackUrl = (name) => `${serverUrl()}/api/auth/oauth/${name}/callback`;
const base64url = (buf) => buf.toString("base64url");
const randomToken = () => base64url(crypto.randomBytes(32));

/** Only a path on the site itself: never `//evil.example` or a full URL. */
function safeReturnTo(value) {
  const path = String(value || "/");
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path.slice(0, 200) : "/";
}

function back(res, fields) {
  res.redirect(`${siteUrl()}/auth/callback#${new URLSearchParams(fields)}`);
}

async function getJson(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

function readCookie(req) {
  for (const part of (req.get("cookie") || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: serverUrl().startsWith("https://"),
  sameSite: "lax", // sent when the provider redirects the player back
  path: "/api/auth/oauth",
});

function sameString(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * The account for a provider identity, linked or made as described at the
 * top. Returns { id, email }, or throws an Error with `reason` "no_email".
 */
export async function findOrCreateOAuthUser({ provider, id, email, emailVerified }) {
  return withTransaction(async (client) => {
    const known = await client.query(
      `select u.id, u.email from oauth_identities o join users u on u.id = o.user_id
        where o.provider = $1 and o.provider_user_id = $2`,
      [provider, id],
    );
    if (known.rows[0]) return known.rows[0];

    if (!email || !emailVerified) {
      throw Object.assign(new Error("provider gave no verified email"), { reason: "no_email" });
    }

    const existing = await client.query("select id, email, email_verified from users where lower(email) = lower($1) for update", [email]);
    let user = existing.rows[0];
    if (user) {
      await client.query(
        `update users set email_verified = true,
           password_hash = case when email_verified then password_hash else null end
         where id = $1`,
        [user.id],
      );
    } else {
      ({
        rows: [user],
      } = await client.query("insert into users (email, email_verified) values ($1, true) returning id, email", [email]));
      await client.query("insert into profiles (id) values ($1)", [user.id]);
    }
    await client.query("insert into oauth_identities (provider, provider_user_id, user_id) values ($1, $2, $3)", [provider, id, user.id]);
    return { id: user.id, email: user.email };
  });
}

export const oauthRouter = express.Router();

// Which sign-in buttons the site should show.
oauthRouter.get("/providers", (_req, res) => {
  res.json({ providers: pool ? Object.keys(PROVIDERS).filter(credentials) : [] });
});

oauthRouter.get("/:provider", (req, res) => {
  const name = req.params.provider;
  const creds = Object.hasOwn(PROVIDERS, name) && pool ? credentials(name) : null;
  if (!creds) return back(res, { error: "unavailable" });

  const provider = PROVIDERS[name];
  const state = randomToken();
  const verifier = randomToken();
  const returnTo = safeReturnTo(req.query.returnTo);
  res.cookie(COOKIE, [state, verifier, base64url(Buffer.from(returnTo))].join("."), { ...cookieOptions(), maxAge: COOKIE_TTL_MS });

  const params = new URLSearchParams({
    client_id: creds.id,
    redirect_uri: callbackUrl(name),
    response_type: "code",
    scope: provider.scope,
    state,
    code_challenge: base64url(crypto.createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    ...provider.extra,
  });
  res.redirect(`${provider.authorize}?${params}`);
});

oauthRouter.get("/:provider/callback", async (req, res) => {
  const name = req.params.provider;
  const cookie = readCookie(req);
  res.clearCookie(COOKIE, cookieOptions());

  const creds = Object.hasOwn(PROVIDERS, name) && pool ? credentials(name) : null;
  if (!creds) return back(res, { error: "unavailable" });
  // The player said no on the provider's screen.
  if (req.query.error) return back(res, { error: "cancelled" });

  const [state, verifier, returnTo64] = (cookie || "").split(".");
  if (!state || !verifier || !req.query.code || !sameString(state, req.query.state)) {
    return back(res, { error: "failed" });
  }

  try {
    const provider = PROVIDERS[name];
    const tokenRes = await fetch(provider.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        grant_type: "authorization_code",
        code: String(req.query.code),
        redirect_uri: callbackUrl(name),
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange answered ${tokenRes.status}`);
    const { access_token: accessToken } = await tokenRes.json();
    if (!accessToken) throw new Error("token exchange gave no access token");

    const who = await provider.identity(accessToken);
    const user = await findOrCreateOAuthUser({ provider: name, ...who });
    back(res, { token: signToken(user), returnTo: safeReturnTo(Buffer.from(returnTo64 || "", "base64url").toString()) });
  } catch (err) {
    if (err.reason) return back(res, { error: err.reason });
    console.error(`[oauth] ${name} sign in failed:`, err.message);
    back(res, { error: "failed" });
  }
});
