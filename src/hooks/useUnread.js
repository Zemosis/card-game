// UNREAD — chat messages from others that arrived while the table's
// slide-out panel (TableChrome's TableSidebar) was shut.

import { useState } from "react";

export function useUnread(messages, open) {
  const count = messages.filter((m) => m.type !== "SYSTEM" && !m.isMe).length;
  const [seen, setSeen] = useState(count);
  // A new match clears the chat; never count below zero.
  if ((open && seen !== count) || seen > count) setSeen(count);
  return open ? 0 : Math.max(0, count - seen);
}
