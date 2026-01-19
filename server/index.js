const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const lobbies = {};

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. PUBLIC LOBBIES
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
    console.log(`Lobby Created: ${lobbyId}`);
    socket.emit('lobby_joined', { lobbyId, isHost: true, mySocketId: socket.id });

    if (!isPrivate) io.emit('public_lobbies_update_trigger');
  });

  // 3. JOIN LOBBY (HANDLES NEW JOINS AND REJOINS)
  socket.on('join_lobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies[lobbyId];

    if (!lobby) {
      socket.emit('error_message', "Lobby not found");
      return;
    }

    // --- REJOIN LOGIC ---
    // Check if a player with this name already exists
    const existingPlayerIndex = lobby.players.findIndex(p => p.name === playerName);
    
    if (existingPlayerIndex !== -1) {
      // It is a REJOIN
      console.log(`${playerName} Rejoined lobby ${lobbyId}`);
      
      // Update the socket ID in the lobby list
      lobby.players[existingPlayerIndex].id = socket.id;
      
      // If the HOST rejoined (refreshed tab), update hostId
      if (lobby.hostName === playerName) {
        lobby.hostId = socket.id;
      }

      socket.join(lobbyId);
      
      // Tell the user they are back in
      socket.emit('lobby_joined', { lobbyId, isHost: (lobby.hostName === playerName), mySocketId: socket.id });
      
      // *** CRITICAL: Tell the Host to update this player's Socket ID in the Game State ***
      io.to(lobby.hostId).emit('player_rejoined', { 
        name: playerName, 
        newSocketId: socket.id 
      });

      // Send them the current game state immediately
      if (lobby.gameState) {
        socket.emit('game_state_update', lobby.gameState);
      }
      return;
    }

    // --- NEW PLAYER LOGIC ---
    if (lobby.players.length >= lobby.max) {
      socket.emit('error_message', "Lobby is full");
      return;
    }

    lobby.players.push({ id: socket.id, name: playerName });
    socket.join(lobbyId);
    console.log(`${playerName} joined ${lobbyId}`);

    socket.emit('lobby_joined', { lobbyId, isHost: false, mySocketId: socket.id });

    io.to(lobbyId).emit('player_joined', { 
      newPlayer: { id: socket.id, name: playerName },
      allPlayers: lobby.players 
    });

    if (!lobby.isPrivate) io.emit('public_lobbies_update_trigger');

    if (lobby.gameState) {
       socket.emit('game_state_update', lobby.gameState);
    } else {
       io.to(lobby.hostId).emit('request_sync'); 
    }
  });

  // --- GAMEPLAY HANDLERS ---
  
  // HOST ASKS: "Should I start a new game or load an old one?"
  socket.on('check_game_status', ({ lobbyId }) => {
    if (lobbies[lobbyId] && lobbies[lobbyId].gameState) {
      // Game exists -> Send it back (Don't create new)
      socket.emit('game_state_update', lobbies[lobbyId].gameState);
    } else {
      // No game -> Tell host to initialize
      socket.emit('game_not_started');
    }
  });

  socket.on('send_initial_state', ({ lobbyId, gameState }) => {
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].gameState = gameState;
      io.to(lobbyId).emit('game_state_update', gameState);
    }
  });

  socket.on('sync_game_state', ({ lobbyId, gameState }) => {
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].gameState = gameState;
      io.to(lobbyId).emit('game_state_update', gameState);
    }
  });

  socket.on('request_move', ({ lobbyId, action, data }) => {
    const lobby = lobbies[lobbyId];
    if (lobby) {
      io.to(lobby.hostId).emit('client_move_request', { 
        action, 
        data, 
        senderId: socket.id 
      });
    }
  });

  // CHAT
  socket.on('send_chat', ({ lobbyId, message, playerName }) => {
    io.to(lobbyId).emit('receive_chat', {
      id: `msg-${Date.now()}-${Math.random()}`,
      type: 'CHAT',
      sender: playerName,
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    // We do NOT remove the player immediately to allow refresh/rejoin.
    // In a production app, you'd use a timeout to remove them after 60s.
  });
});
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
