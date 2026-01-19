const express = require('express');
jonst http = require('http');
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
    
    // Send back the lobbyId and the player's OWN socket ID
    socket.emit('lobby_joined', { lobbyId, isHost: true, mySocketId: socket.id });

    if (!isPrivate) io.emit('public_lobbies_update_trigger');
  });

  // 3. JOIN LOBBY
  socket.on('join_lobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies[lobbyId];

    if (!lobby) {
      socket.emit('error_message', "Lobby not found");
      return;
    }

    const alreadyIn = lobby.players.find(p => p.id === socket.id);
    
    if (!alreadyIn) {
      if (lobby.players.length >= lobby.max) {
        socket.emit('error_message', "Lobby is full");
        return;
      }
      lobby.players.push({ id: socket.id, name: playerName });
      socket.join(lobbyId);
    }

    console.log(`${playerName} joined ${lobbyId}`);

    // Tell the joiner they are in, and give them their ID
    socket.emit('lobby_joined', { lobbyId, isHost: false, mySocketId: socket.id });

    // Tell the HOST to update their game board
    io.to(lobbyId).emit('player_joined', { 
      newPlayer: { id: socket.id, name: playerName },
      allPlayers: lobby.players 
    });

    if (!lobby.isPrivate) io.emit('public_lobbies_update_trigger');

    // Send current game state if exists
    if (lobby.gameState) {
       socket.emit('game_state_update', lobby.gameState);
    } else {
       io.to(lobby.hostId).emit('request_sync'); 
    }
  });

  // 4. GAMEPLAY HANDLERS
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
      // Forward the SENDER ID so Host knows who asked
      io.to(lobby.hostId).emit('client_move_request', { 
        action, 
        data, 
        senderId: socket.id 
      });
    }
  });

  // 5. DISCONNECT
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    
    for (const [id, lobby] of Object.entries(lobbies)) {
      const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        lobby.players.splice(playerIndex, 1);
        
        if (lobby.players.length === 0) {
          delete lobbies[id];
        } else {
          // If host left, assign new host
          if (lobby.hostId === socket.id) {
             lobby.hostId = lobby.players[0].id; 
          }
          // Notify remaining players
          io.to(id).emit('player_left', { leaverId: socket.id });
          io.to(id).emit('public_lobbies_update_trigger');
        }
        break;
      }
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING ON PORT 3001");
});
