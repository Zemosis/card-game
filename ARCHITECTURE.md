# Architecture & Technical Specification
**Project:** Khuzur Card Hall (Multiplayer Web Card Game)
**Chosen Architecture:** Stateful Authoritative Node.js Server + Serverless DB/Auth

## 1. Core Philosophy & Strategy
This project uses a hybrid architecture designed for real-time multiplayer card games (Thirteen, Muushig). 
* **Stateful Real-Time:** Because card games require perfect synchronization and strict anti-cheat (hidden hands, valid move checking), the game state lives entirely in the RAM of a dedicated Node.js/Socket.IO server. 
* **Authoritative Server:** Clients NEVER dictate the game state. The server holds the deck, shuffles, validates every card played, and only broadcasts public state (or private cards) to the specific clients allowed to see them.
* **Serverless Persistence:** To avoid managing databases, we use Supabase purely for PostgreSQL storage (long-term records) and Authentication. 

> **CRITICAL DIRECTIVE FOR AI AGENTS:** Do **NOT** implement Supabase Realtime Broadcast or Supabase Presence. All transient in-game communication, matchmaking, and chat must go through the custom Node.js `Socket.IO` server. 

---

## 2. Tech Stack & Tools

### Frontend (Client)
* **Framework:** React 19 + Vite
* **Styling:** Tailwind CSS v4
* **Routing:** React Router v7
* **Hosting:** Vercel (Auto-deploys from GitHub `main` branch)
* **Realtime Client:** `socket.io-client` v4 (Connects to the Node.js server)
* **Auth/DB Client:** `@supabase/supabase-js` (For login/signup and fetching static leaderboard data directly from the frontend)

### Backend (Server)
* **Runtime:** Node.js + Express
* **Realtime Engine:** `Socket.IO` v4
* **Hosting:** Render, Railway, or Fly.io (Requires persistent WebSocket connection support)
* **Role:** Matchmaking, Lobby Management, Authoritative Game Logic, Move Validation, State Broadcasting.

### Database & Auth (Supabase)
* **Authentication:** Supabase Auth (Email/Password & OAuth).
* **Database:** Supabase PostgreSQL.
* **Role:** Stores permanent data (User Profiles, Total Wins, Game History). The Node.js server uses the Supabase Admin API to write match results to the DB when a game ends.

---

## 3. Current State vs. Target State

### Current State (Where we are now)
* **Server:** A basic Node.js/Socket.IO server exists (`server/index.js`) handling basic lobby creation, joins, and primitive state syncing.
* **Flaw:** Game logic is currently *Client/Host-Authoritative*. The server acts as a dumb relay, meaning a modified client can cheat easily.
* **Auth:** Currently uses transient "Guest" identities stored in local state/storage. No real persistence.
* **UI:** Menu exists with placeholders for features like "Shop", "Rank V", and specific player tags.

### Target State (What needs to be built)
* **Auth Implementation:** Replace guest accounts with Supabase Auth.
* **Server Authority:** The Node.js server must parse game rules. When a client emits `play_card`, the server checks if it's their turn and if the move is legal before updating the RAM state and emitting `state_update`.
* **Secure Reconnection:** Reconnection logic must verify the user via their Supabase Auth JWT, not just a claimed "username".
* **Persistent Scoring:** Upon game completion, the server calculates Elo/Coins/Wins and writes securely to Supabase Postgres.

---

## 4. Database Schema (Supabase Postgres)

```sql
-- Create custom types
CREATE TYPE game_type AS ENUM ('thirteen', 'muushig');
CREATE TYPE match_status AS ENUM ('in_progress', 'finished', 'abandoned');

-- Profiles (Tied to Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  tag TEXT NOT NULL, -- e.g., #1234
  avatar_url TEXT,
  custom_avatar_data JSONB, -- For Avatar Paint feature
  coins INT DEFAULT 0,
  rank_level INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match History (Written by the Node.js Server)
CREATE TABLE match_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game game_type NOT NULL,
  status match_status NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Match Participants (Written by Node.js Server)
CREATE TABLE match_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES match_history(id),
  player_id UUID REFERENCES profiles(id),
  placement INT, -- 1st, 2nd, 3rd, etc.
  score_delta INT -- Points gained/lost
);

-- Leaderboards (View or Table)
CREATE TABLE leaderboards (
  player_id UUID REFERENCES profiles(id) PRIMARY KEY,
  thirteen_wins INT DEFAULT 0,
  muushig_wins INT DEFAULT 0,
  total_games_played INT DEFAULT 0
);
```

## 5. Security & Authentication Flow
To prevent unauthorized Socket.IO connections and impersonation:

Client logs in via Supabase Auth on the frontend.

Client extracts the JWT (session.access_token).

Client connects to Socket.IO passing the token:

```javascript
const socket = io("https://your-backend-url", {
  auth: { token: session.access_token }
});
```
Server Middleware validates the token using the Supabase JWT secret.

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT using jsonwebtoken library and Supabase JWT Secret
  // Attach decoded user.id to socket for future requests
});
## 6. Actionable Implementation Plan (TODO)
### Phase 1: Database & Identity Integration
[x] Setup Supabase project. Create the profiles table.

[x] Update frontend useAuth.jsx to wrap @supabase/supabase-js.

[x] Replace guest login with actual Supabase Sign Up / Login UI.

[x] Ensure user profile data (Coins, Rank, Username) populates the Main Menu Top Bar.

### Phase 2: Secure the WebSocket Server
[x] Add JWT authentication middleware to server/index.js. (Tokens verified via `supabase.auth.getUser()`; guests identified by name#tag from the handshake.)

[x] Refactor the lobbies memory object to map Socket IDs to verified Supabase user.ids. (`lobby.members` is keyed by playerKey = user id or guest identity; socket ids are re-bound on reconnect.)

[x] Implement robust disconnect/reconnection logic (60-second grace period; after that a CPU takes over the seat so the match continues).

### Phase 3: Move Game Logic to Server (CRITICAL)
[x] Migrate game logic into the server/ directory. (`server/game/` holds constants, deckUtils, handEvaluator, gameLogic, aiPlayer + the authoritative `engine.js` wrapper.)

[x] Rewrite Socket.IO handlers. `sync_game_state` / `send_initial_state` removed — clients can no longer dictate state.

[x] Implement request_move -> Server Validates -> Server Emits game_state_update. (Turn order, card ownership, and combination legality all checked server-side; rejections come back as `move_rejected`.)

[x] Server strips hidden information: every other player's hand is replaced with `{hidden: true}` placeholders (length preserved for card-back rendering) before emitting to each client.

### Phase 4: Match Recording & Persistence
[x] Install @supabase/supabase-js on the Node.js server.

[x] Initialize Supabase client on the server using the SERVICE_ROLE_KEY. (Set `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`; without it the server runs fine but skips recording.)

[x] On game over the server writes `game_sessions` + `game_players` rows and updates `profiles` (coins, exp, level, wins, games_played). Rewards by placement: 100/50/25/10 coins, 60/35/20/10 exp; level = exp/100 + 1.

## 7. Future Features Roadmap (Context for System Design)
The architecture must be built to support these upcoming features noted in the UI placeholders:

The Shop & Economy: Players will earn "Coins" for winning matches. These coins will be spent on Card Skins, Custom Avatars, and Emotes. (Database profiles.coins is required).

Progression System: The third locked game on the menu requires reaching "Rank V". The Node.js server will need to calculate XP/Rank increments upon match completion.

Avatar Paint: The custom drawn avatars (currently handled locally/base64) must be serialized as JSONB or uploaded to Supabase Storage buckets, attached to the profiles table, and sent to other clients upon joining a lobby.

## 8. Environment Variables Required
### Frontend (.env)
```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_WEBSOCKET_URL=http://localhost:3001 # Production: wss://your-backend.render.com
```
### Backend (server/.env)
```bash
PORT=3001
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_secret_admin_key # NEVER SHARE WITH FRONTEND
SUPABASE_JWT_SECRET=your_jwt_secret # Used to decode incoming Socket.io handshakes
CORS_ORIGIN=http://localhost:5173 # Production: [https://your-frontend.vercel.app]
```