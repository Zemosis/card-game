# Architecture & Tools

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Frontend | React 19 + Vite | UI rendering, fast builds |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Routing | React Router v7 | Client-side page navigation |
| Auth | Supabase Auth | User accounts, login/signup, sessions |
| Database | Supabase Postgres | Lobbies, game history, scores, leaderboards |
| Realtime | Supabase Realtime (Broadcast) | All multiplayer communication — lobby events AND in-game moves |
| Server Logic | Supabase Edge Functions | Game validation, anti-cheat, score recording |
| Hosting | Vercel | Static frontend deployment (auto-deploys from GitHub) |

## No Socket.IO. No Express. No server folder.

Everything goes through Supabase:
- **Supabase Realtime Broadcast** replaces Socket.IO for game moves, turn updates, chat
- **Supabase Realtime Postgres Changes** for lobby list updates (new lobby created, player count changes)
- **Supabase Edge Functions** for any server-side validation (preventing cheating, recording final scores)
- **Supabase Auth** for user identity

### Why full Supabase

1. **Zero servers to maintain** — no Express, no Render, no Railway. Supabase + Vercel handles everything.
2. **Free tier is generous** — Supabase: 500MB DB, 50k MAU, 2GB bandwidth, unlimited Realtime connections. Vercel: unlimited static deploys.
3. **Single source of truth** — auth, data, and realtime all in one place with RLS (Row Level Security) for protection.
4. **Broadcast channels are fast enough** — card games don't need sub-10ms latency. Supabase Realtime Broadcast is WebSocket-based and works well for turn-based games.

## Database Schema (Supabase Postgres)

```
profiles
├── id (uuid, references auth.users)
├── username (text, unique)
├── avatar_url (text, nullable)
└── created_at (timestamp)

game_sessions
├── id (uuid)
├── game_type (text: 'thirteen' | 'muushig')
├── status (text: 'lobby' | 'in_progress' | 'finished')
├── host_id (uuid, references profiles)
├── is_private (boolean)
├── lobby_code (text, nullable)
├── max_players (int)
├── created_at (timestamp)
└── finished_at (timestamp, nullable)

game_players
├── id (uuid)
├── session_id (uuid, references game_sessions)
├── player_id (uuid, references profiles)
├── score (int)
├── is_eliminated (boolean)
└── joined_at (timestamp)

leaderboard
├── id (uuid)
├── player_id (uuid, references profiles)
├── game_type (text)
├── wins (int)
├── games_played (int)
└── updated_at (timestamp)
```

## How Realtime Works

### Lobby Level — Postgres Changes
Supabase listens to `game_sessions` and `game_players` table changes. When someone creates a lobby or joins one, all clients subscribed to the lobby list get the update automatically.

### In-Game — Broadcast Channels
Each game session gets a Broadcast channel (e.g., `game:abc123`). All game moves, chat messages, and state updates go through this channel. No data is stored in the DB during gameplay — only final results are persisted.

```
Player plays card → Broadcast to channel → All players receive update
Player sends chat → Broadcast to channel → All players see message
Game ends → Edge Function records scores to DB
```

### Presence
Supabase Presence tracks who is online in a lobby/game. Handles disconnect detection and rejoin without custom heartbeat logic.

## Database Schema (Supabase Postgres)

```
profiles
├── id (uuid, references auth.users)
├── username (text, unique)
├── avatar_url (text, nullable)
└── created_at (timestamp)

game_sessions
├── id (uuid)
├── game_type (text: 'thirteen' | 'muushig')
├── status (text: 'lobby' | 'in_progress' | 'finished')
├── host_id (uuid, references profiles)
├── is_private (boolean)
├── lobby_code (text, nullable)
├── max_players (int)
├── created_at (timestamp)
└── finished_at (timestamp, nullable)

game_players
├── id (uuid)
├── session_id (uuid, references game_sessions)
├── player_id (uuid, references profiles)
├── score (int)
├── is_eliminated (boolean)
└── joined_at (timestamp)

leaderboard
├── id (uuid)
├── player_id (uuid, references profiles)
├── game_type (text)
├── wins (int)
├── games_played (int)
└── updated_at (timestamp)
```

## Migration Plan

### Phase 1: Foundation
- Install `@supabase/supabase-js`
- Create `src/lib/supabase.js` client
- Create `profiles` table with RLS
- Build login/signup pages
- Remove `socket.io-client` from frontend dependencies

### Phase 2: Lobbies
- Create `game_sessions` and `game_players` tables
- Rewrite lobby pages to use Supabase DB + Realtime Postgres Changes
- Lobby list auto-updates via subscription

### Phase 3: In-Game Realtime
- Replace all Socket.IO game communication with Supabase Broadcast channels
- Use Presence for player online/offline status
- Host-authoritative game logic runs client-side (host validates moves, broadcasts state)

### Phase 4: Server Validation + Scores
- Create Edge Functions for score recording and anti-cheat checks
- Create `leaderboard` table
- Record game results on completion

### Phase 5: Deploy
- Connect GitHub repo to Vercel (auto-deploy on push)
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env vars
- Delete `server/` folder entirely
- Done

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## File Structure (target)

```
card_game/
├── src/
│   ├── lib/
│   │   └── supabase.js              # Supabase client init
│   ├── hooks/
│   │   ├── useAuth.js                # Auth state hook
│   │   ├── useRealtimeChannel.js     # Broadcast channel hook
│   │   └── usePresence.js            # Online/offline tracking
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Signup.jsx
│   │   ├── thirteen/
│   │   │   ├── LobbySelection.jsx
│   │   │   ├── GameThirteen.jsx
│   │   │   └── rulebook.md
│   │   ├── muushig/
│   │   │   ├── LobbyMuushig.jsx
│   │   │   ├── GameMuushig.jsx
│   │   │   └── rulebook.md
│   │   └── MainMenu.jsx
│   ├── components/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   ├── migrations/                   # SQL migration files
│   └── functions/                    # Edge Functions (score recording, validation)
├── package.json
├── vite.config.js
└── vercel.json
```
