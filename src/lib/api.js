// HTTP client for the game server's account routes (server/auth.js).
// The session token lives in localStorage and is sent as a Bearer header here
// and in the socket handshake (utils/socket.js).

export const SERVER_URL = import.meta.env.VITE_WEBSOCKET_URL || "http://localhost:3001";

const TOKEN_KEY = "khuzur_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode / blocked storage: the session just won't survive a reload.
  }
}

/** Calls /api/auth/<path>. Throws an Error carrying the server's message and HTTP status. */
export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${SERVER_URL}/api/auth${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the game server");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
