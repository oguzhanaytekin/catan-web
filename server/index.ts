import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createGameStateFromLobby } from '../src/game/gameState';
import type { GameState } from '../src/game/gameState';
import * as gameEngine from '../src/game/gameEngine';
import { generateRandomMap, generateBoardGraph } from '../src/utils/mapGenerator';
import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────
interface RoomMember {
  socketId: string;
  username: string;
  color: string;
  isOwner: boolean;
}

interface RoomData {
  password: string;
  members: RoomMember[];
  gameState: GameState | null;
  started: boolean;
}

// ─── Express Setup ───────────────────────────────────────
const app = express();
app.use(cors());

const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  console.log('Dist folder found.');
  app.use(express.static(distPath));
}

// ─── Socket.IO Setup ────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Room Storage ────────────────────────────────────────
const rooms: Record<string, RoomData> = {};

const PLAYER_COLORS: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  white: '#f8fafc',
  orange: '#f97316',
};

// Helper: build sanitized lobby info to send to clients
function buildLobbyUpdate(roomName: string) {
  const room = rooms[roomName];
  if (!room) return null;
  return {
    roomName,
    members: room.members.map(m => ({
      username: m.username,
      color: m.color,
      isOwner: m.isOwner,
    })),
    started: room.started,
    takenColors: room.members.map(m => m.color),
    takenUsernames: room.members.map(m => m.username),
  };
}

// ─── Socket Handlers ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Track which room this socket is in
  let currentRoom: string | null = null;

  // ── Create Room ──────────────────────────────────────
  socket.on('createRoom', ({ roomName, password, username, color }: {
    roomName: string; password: string; username: string; color: string;
  }) => {
    // Validation
    if (!roomName || !password || !username || !color) {
      return socket.emit('lobbyError', 'Tüm alanlar doldurulmalıdır.');
    }
    if (rooms[roomName]) {
      return socket.emit('lobbyError', 'Bu isimde bir oda zaten mevcut.');
    }
    if (!PLAYER_COLORS[color]) {
      return socket.emit('lobbyError', 'Geçersiz renk seçimi.');
    }

    // Create room
    rooms[roomName] = {
      password,
      members: [{
        socketId: socket.id,
        username,
        color,
        isOwner: true,
      }],
      gameState: null,
      started: false,
    };

    currentRoom = roomName;
    socket.join(roomName);
    console.log(`Room "${roomName}" created by ${username} (${socket.id})`);

    socket.emit('roomJoined', { roomName, isOwner: true });
    io.to(roomName).emit('lobbyUpdate', buildLobbyUpdate(roomName));
  });

  // ── Join Room ────────────────────────────────────────
  socket.on('joinRoom', ({ roomName, password, username, color }: {
    roomName: string; password: string; username: string; color: string;
  }) => {
    if (!roomName || !password || !username || !color) {
      return socket.emit('lobbyError', 'Tüm alanlar doldurulmalıdır.');
    }

    const room = rooms[roomName];
    if (!room) {
      return socket.emit('lobbyError', 'Bu isimde bir oda bulunamadı.');
    }
    if (room.password !== password) {
      return socket.emit('lobbyError', 'Oda şifresi yanlış.');
    }
    if (room.started) {
      return socket.emit('lobbyError', 'Bu odada oyun zaten başlamış.');
    }
    if (room.members.length >= 4) {
      return socket.emit('lobbyError', 'Oda dolu (maksimum 4 oyuncu).');
    }
    if (room.members.some(m => m.username.toLowerCase() === username.toLowerCase())) {
      return socket.emit('lobbyError', 'Bu kullanıcı adı zaten alınmış.');
    }
    if (room.members.some(m => m.color === color)) {
      return socket.emit('lobbyError', 'Bu renk zaten başka bir oyuncu tarafından seçilmiş.');
    }
    if (!PLAYER_COLORS[color]) {
      return socket.emit('lobbyError', 'Geçersiz renk seçimi.');
    }

    room.members.push({
      socketId: socket.id,
      username,
      color,
      isOwner: false,
    });

    currentRoom = roomName;
    socket.join(roomName);
    console.log(`${username} (${socket.id}) joined room "${roomName}"`);

    socket.emit('roomJoined', { roomName, isOwner: false });
    io.to(roomName).emit('lobbyUpdate', buildLobbyUpdate(roomName));
  });

  // ── Start Game ───────────────────────────────────────
  socket.on('startGame', ({ roomName }: { roomName: string }) => {
    const room = rooms[roomName];
    if (!room) return socket.emit('lobbyError', 'Oda bulunamadı.');

    const member = room.members.find(m => m.socketId === socket.id);
    if (!member || !member.isOwner) {
      return socket.emit('lobbyError', 'Sadece oda sahibi oyunu başlatabilir.');
    }
    if (room.members.length < 3) {
      return socket.emit('lobbyError', 'Oyun başlatmak için en az 3 oyuncu gerekli.');
    }
    if (room.started) {
      return socket.emit('lobbyError', 'Oyun zaten başlamış.');
    }

    // Generate board
    const hexes = generateRandomMap();
    const graph = generateBoardGraph(hexes, 65);

    // Create game state from lobby members
    const lobbyPlayers = room.members.map(m => ({
      username: m.username,
      color: PLAYER_COLORS[m.color],
      colorKey: m.color,
    }));

    room.gameState = createGameStateFromLobby(lobbyPlayers, { hexes, graph });
    room.started = true;

    console.log(`Game started in room "${roomName}" with ${room.members.length} players.`);
    io.to(roomName).emit('gameStarted', room.gameState);
  });

  // ── Game Actions ─────────────────────────────────────
  socket.on('action', ({ roomName, type, payload }: {
    roomName: string; type: string; payload: any;
  }) => {
    const room = rooms[roomName];
    if (!room || !room.gameState) return;

    let newState = room.gameState;
    try {
      switch (type) {
        case 'rollDice':
          newState = gameEngine.rollDice(room.gameState);
          break;
        case 'endTurn':
          newState = gameEngine.endTurn(room.gameState);
          break;
        case 'buildRoad':
          newState = gameEngine.buildRoad(room.gameState, payload.edgeId, payload.playerId);
          break;
        case 'buildSettlement':
          newState = gameEngine.buildSettlement(room.gameState, payload.nodeId, payload.playerId);
          break;
        case 'upgradeCity':
          newState = gameEngine.upgradeCity(room.gameState, payload.nodeId, payload.playerId);
          break;
        case 'buyDevCard':
          newState = gameEngine.buyDevelopmentCard(room.gameState, payload.playerId);
          break;
        case 'playKnight':
          newState = gameEngine.playKnightCard(room.gameState, payload.playerId);
          break;
        case 'moveRobber':
          newState = gameEngine.moveRobber(room.gameState, payload.hexId, payload.stealFromId, payload.playerId);
          break;
        case 'tradeWithBank':
          newState = gameEngine.tradeWithBank(room.gameState, payload.playerId, payload.offer, payload.ask);
          break;
      }
    } catch (e) {
      console.error(`Error processing action ${type}:`, e);
    }

    if (newState !== room.gameState) {
      room.gameState = newState;
      io.to(roomName).emit('gameState', newState);
    }
  });

  // ── Disconnect ───────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    if (currentRoom && rooms[currentRoom]) {
      const room = rooms[currentRoom];
      const memberIndex = room.members.findIndex(m => m.socketId === socket.id);

      if (memberIndex !== -1) {
        const wasOwner = room.members[memberIndex].isOwner;
        room.members.splice(memberIndex, 1);

        // If room is empty, delete it
        if (room.members.length === 0) {
          delete rooms[currentRoom];
          console.log(`Room "${currentRoom}" deleted (empty).`);
        } else {
          // If owner left and game hasn't started, transfer ownership
          if (wasOwner && !room.started && room.members.length > 0) {
            room.members[0].isOwner = true;
            console.log(`Ownership of "${currentRoom}" transferred to ${room.members[0].username}`);
          }
          io.to(currentRoom).emit('lobbyUpdate', buildLobbyUpdate(currentRoom));
        }
      }
    }
  });
});

// SPA catch-all (AFTER socket setup, LAST middleware)
app.use((req: any, res: any) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Catan Server running on port ${PORT}`);
});
