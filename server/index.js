const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configure Socket.io with CORS to allow client connection
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your Vite Frontend URL
    methods: ["GET", "POST"]
  }
});

// --- GAME STATE MEMORY ---
const lobbies = {}; // { lobbyId: { name, hostId, players: [], max: 4, gameState: {} } }

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. GET PUBLIC LOBBIES
  socket.on('get_public_lobbies', () => {
    const publicList = Object.values(lobbies)
      .filter(l => !l.isPrivate)
      .map(l => ({
        id: l.id,
        name: l.name,
        host: l.hostName,
        current: l.players.length,
        max: l.max
      }));
    socket.emit('public_lobbies_update', publicList);
  });

  // 2. CREATE LOBBY
  socket.on('create_lobby', ({ lobbyName, playerName, isPrivate }) => {
    const lobbyId = isPrivate
      ? Math.random().toString(36).substring(2, 8).toUpperCase()
      : 'PUB-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create the new lobby object
    lobbies[lobbyId] = {
      id: lobbyId,
      name: lobbyName,
      hostId: socket.id,
      hostName: playerName,
      isPrivate: isPrivate,
      players: [{ id: socket.id, name: playerName }],
      max: 4,
      gameState: null
    };

    socket.join(lobbyId);
    console.log(`Lobby Created: ${lobbyName} (${lobbyId}) by ${playerName}`);

    // Respond to creator
    socket.emit('lobby_joined', { lobbyId, isHost: true });

    // Broadcast update to public list listeners
    if (!isPrivate) {
      io.emit('public_lobbies_update_trigger');
    }
    // Note: No gameState check needed here because the game hasn't started yet!
  });

  // 3. JOIN LOBBY
  socket.on('join_lobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies[lobbyId]; // <--- This defines the 'lobby' variable

    if (!lobby) {
      socket.emit('error_message', "Lobby not found");
      return;
    }

    if (lobby.players.length >= lobby.max) {
      socket.emit('error_message', "Lobby is full");
      return;
    }

    // Add player
    lobby.players.push({ id: socket.id, name: playerName });
    socket.join(lobbyId);

    console.log(`${playerName} joined ${lobbyId}`);

    // Notify the joiner
    socket.emit('lobby_joined', { lobbyId, isHost: false });
    
    // Notify the room
    io.to(lobbyId).emit('player_joined', { players: lobby.players });

    // Update public lists
    if (!lobby.isPrivate) {
      io.emit('public_lobbies_update_trigger');
    }

    // *** FIX: Send existing game state if joining mid-game ***
    if (lobby.gameState) {
       socket.emit('game_state_update', lobby.gameState);
    }
  });

  // --- GAMEPLAY HANDLERS ---

  // 4. Host sends the initial game state
  socket.on('send_initial_state', ({ lobbyId, gameState }) => {
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].gameState = gameState;
      io.to(lobbyId).emit('game_state_update', gameState);
    }
  });

  // 5. Host sends an updated state (after a move)
  socket.on('sync_game_state', ({ lobbyId, gameState }) => {
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].gameState = gameState;
      io.to(lobbyId).emit('game_state_update', gameState);
    }
  });

  // 6. Client (Player 2/3/4) wants to make a move
  socket.on('request_move', ({ lobbyId, action, data }) => {
    const lobby = lobbies[lobbyId];
    if (lobby) {
      // Forward this request ONLY to the Host
      io.to(lobby.hostId).emit('client_move_request', {
        action,
        data,
        senderId: socket.id
      });
    }
  });

  // 7. DISCONNECT
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    // Optional: Remove player from lobbies logic would go here
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING ON PORT 3001");
});
