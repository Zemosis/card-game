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
// In a real app, use a database (Redis/MongoDB). For now, JS objects work.
const lobbies = {}; // { lobbyId: { name, hostId, players: [], max: 4, gameState: {} } }

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. GET PUBLIC LOBBIES
  socket.on('get_public_lobbies', () => {
    // Convert lobbies object to array and filter for public ones
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
    // Generate ID (6 chars for private, longer for public to avoid collision)
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
      gameState: null // Placeholder for future game logic
    };

    socket.join(lobbyId);
    console.log(`Lobby Created: ${lobbyName} (${lobbyId}) by ${playerName}`);
    
    // Respond to creator
    socket.emit('lobby_joined', { lobbyId, isHost: true });
    
    // Broadcast update to everyone looking at public list
    if (!isPrivate) {
      io.emit('public_lobbies_update_trigger'); 
    }
  });

  // 3. JOIN LOBBY
  socket.on('join_lobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies[lobbyId];

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

    // Notify player they succeeded
    socket.emit('lobby_joined', { lobbyId, isHost: false });

    // Notify others in room
    io.to(lobbyId).emit('player_joined', { 
      players: lobby.players 
    });

    // Update public lists
    if (!lobby.isPrivate) {
      io.emit('public_lobbies_update_trigger');
    }
  });

  // 4. DISCONNECT
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    // Cleanup logic (removing players from lobbies) would go here
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING ON PORT 3001");
});
