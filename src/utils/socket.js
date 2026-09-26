import { io } from "socket.io-client";
import { SERVER_URL, getToken } from "../lib/api";

// Connection is deferred until we know who the player is — the server reads
// identity (session JWT or guest name/tag) from the handshake.
export const socket = io(SERVER_URL, { autoConnect: false });

let lastAuthKey = null;

/**
 * Connects (or reconnects with new identity) using the current auth session.
 * Safe to call repeatedly — no-ops if already connected as the same identity.
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h;
}

export async function connectSocket(identity) {
  const token = getToken();

  const auth = {
    token,
    name: identity?.name || "PLAYER",
    tag: identity?.tag || "0000",
    // Guests' preset; signed-in players' avatars are read from their profile.
    avatar: identity?.avatar,
  };
  // A changed avatar reconnects so the table sees the new one.
  const avatarKey = `${identity?.avatar}:${hashString(JSON.stringify(identity?.customAvatar || null))}`;
  const authKey = `${auth.token || ""}|${auth.name}|${auth.tag}|${avatarKey}`;

  if (socket.connected && authKey === lastAuthKey) return;
  if (socket.connected) socket.disconnect();

  socket.auth = auth;
  lastAuthKey = authKey;
  socket.connect();
}
