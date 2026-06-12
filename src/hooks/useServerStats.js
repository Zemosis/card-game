// Live server stats (online count, open tables, ping) polled over the socket.

import { useState, useEffect } from "react";
import { socket } from "../utils/socket";

const POLL_INTERVAL = 10_000;

export function useServerStats({ enabled = true } = {}) {
  const [stats, setStats] = useState({
    connected: socket.connected,
    online: null,
    tables: null,
    ping: null,
  });

  useEffect(() => {
    if (!enabled) return;

    let alive = true;

    const poll = () => {
      if (!socket.connected) {
        setStats((s) => ({ ...s, connected: false }));
        return;
      }
      const start = performance.now();
      socket.timeout(4000).emit("ping_check", (err) => {
        if (!alive || err) return;
        const ping = Math.max(1, Math.round(performance.now() - start));
        setStats((s) => ({ ...s, connected: true, ping }));
      });
      socket.timeout(4000).emit("get_stats", (err, data) => {
        if (!alive || err || !data) return;
        setStats((s) => ({
          ...s,
          connected: true,
          online: data.online,
          tables: data.tables,
        }));
      });
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    const onConnect = () => poll();
    const onDisconnect = () =>
      setStats({ connected: false, online: null, tables: null, ping: null });
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      alive = false;
      clearInterval(interval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [enabled]);

  return stats;
}
