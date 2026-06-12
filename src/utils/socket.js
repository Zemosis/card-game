import { io } from "socket.io-client";
import { supabase } from "../lib/supabase";

const URL = import.meta.env.VITE_WEBSOCKET_URL || "http://localhost:3001";

// Connection is deferred until we know who the player is — the server reads
// identity (Supabase JWT or guest name/tag) from the handshake.
export const socket = io(URL, { autoConnect: false });

let lastAuthKey = null;

/**
 * Connects (or reconnects with new identity) using the current auth session.
 * Safe to call repeatedly — no-ops if already connected as the same identity.
 */
export async function connectSocket(identity) {
  let token = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  }

  const auth = {
    token,
    name: identity?.name || "PLAYER",
    tag: identity?.tag || "0000",
  };
  const authKey = `${auth.token || ""}|${auth.name}|${auth.tag}`;

  if (socket.connected && authKey === lastAuthKey) return;
  if (socket.connected) socket.disconnect();

  socket.auth = auth;
  lastAuthKey = authKey;
  socket.connect();
}
