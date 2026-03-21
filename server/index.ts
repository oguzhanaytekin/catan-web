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
interface User {
  username: string;
  passwordHash: string;
}

interface RoomMember {
  socketId: string;
  username: string;
  color: string;
  isOwner: boolean;
  connected: boolean;
  disconnectTimer?: ReturnType<typeof setTimeout>;
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

// ─── User Storage ────────────────────────────────────────
const USERS_FILE = 'users.json';
let users: Record<string, User> = {};

if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    users = JSON.parse(data);
  } catch (e) {
    console.error('Error loading users.json:', e);
  }
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password: string) {
  // Simple build-in hash for demonstration
  return path.join(password, 'salt'); // Placeholder or use crypto
}

import crypto from 'crypto';
function safeHash(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ─── Room Storage ────────────────────────────────────────
const rooms: Record<string, RoomData> = {};

const PLAYER_COLORS: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  white: '#f8fafc',
  orange: '#f97316',
};

const DISCONNECT_TIMEOUT_MS = 30_000;

function buildLobbyUpdate(roomName: string) {
  const room = rooms[roomName];
  if (!room) return null;
  return {
    roomName,
    members: room.members.map(m => ({
      username: m.username,
      color: m.color,
      isOwner: m.isOwner,
      connected: m.connected,
    })),
    started: room.started,
    takenColors: room.members.map(m => m.color),
    takenUsernames: room.members.map(m => m.username),
  };
}

// Helper: find which playerId (p1, p2...) corresponds to a username
function findPlayerIdByUsername(state: GameState, username: string): string | null {
  for (const pid of state.turnOrder) {
    if (state.players[pid]?.name === username) return pid;
  }
  return null;
}

// Helper: skip disconnected player's turn
function skipDisconnectedPlayerTurn(roomName: string) {
  const room = rooms[roomName];
  if (!room || !room.gameState) return;

  const state = room.gameState;
  const currentPid = state.turnOrder[state.currentTurnIndex];
  const currentMember = room.members.find(m => {
    const pid = findPlayerIdByUsername(state, m.username);
    return pid === currentPid;
  });

  // Only skip if the current player is disconnected
  if (currentMember && !currentMember.connected) {
    console.log(`Auto-skipping turn for disconnected player "${currentMember.username}" in room "${roomName}"`);
    let newState = gameEngine.endTurn(state);
    // If we're in a phase that doesn't allow endTurn (e.g. need to roll), force through
    if (newState === state) {
      // Force roll dice if needed
      if (state.turnPhase === 'ROLL') {
        newState = gameEngine.rollDice(state);
        if (newState !== state) {
          newState = gameEngine.endTurn(newState);
        }
      }
      // If still stuck (e.g. ROBBER_MOVE), just move to next player
      if (newState === state) {
        const nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
        newState = {
          ...state,
          currentTurnIndex: nextIndex,
          turnPhase: 'ROLL',
          diceState: { die1: 1, die2: 1, rolled: false },
        };
      }
    }
    room.gameState = newState;
    io.to(roomName).emit('gameState', newState);

    // Check if the NEXT player is also disconnected, and schedule skip for them too
    const nextPid = newState.turnOrder[newState.currentTurnIndex];
    const nextMember = room.members.find(m => findPlayerIdByUsername(newState, m.username) === nextPid);
    if (nextMember && !nextMember.connected) {
      setTimeout(() => skipDisconnectedPlayerTurn(roomName), 2000);
    }
  }
}

// ─── Socket Handlers ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  let currentRoom: string | null = null;
  let authenticatedUser: string | null = null;

  // ── Auth ─────────────────────────────────────────────
  socket.on('register', ({ username, password }) => {
    if (!username || !password) {
      return socket.emit('authError', 'Kullanıcı adı ve şifre gereklidir.');
    }
    if (users[username]) {
      return socket.emit('authError', 'Bu kullanıcı adı zaten mevcut.');
    }
    users[username] = {
      username,
      passwordHash: safeHash(password),
    };
    saveUsers();
    authenticatedUser = username;
    socket.emit('authSuccess', { username });
    console.log(`User registered: ${username}`);
  });

  socket.on('login', ({ username, password }) => {
    const user = users[username];
    if (!user || user.passwordHash !== safeHash(password)) {
      return socket.emit('authError', 'Geçersiz kullanıcı adı veya şifre.');
    }
    authenticatedUser = username;
    socket.emit('authSuccess', { username });
    console.log(`User logged in: ${username}`);
  });

  // ── Create Room ──────────────────────────────────────
  socket.on('createRoom', ({ roomName, password, color }: {
    roomName: string; password: string; color: string;
  }) => {
    if (!authenticatedUser) {
      return socket.emit('lobbyError', 'Önce giriş yapmalısınız.');
    }
    const username = authenticatedUser;

    if (!roomName || !password || !color) {
      return socket.emit('lobbyError', 'Tüm alanlar doldurulmalıdır.');
    }
    if (rooms[roomName]) {
      return socket.emit('lobbyError', 'Bu isimde bir oda zaten mevcut.');
    }
    if (!PLAYER_COLORS[color]) {
      return socket.emit('lobbyError', 'Geçersiz renk seçimi.');
    }

    rooms[roomName] = {
      password,
      members: [{
        socketId: socket.id,
        username,
        color,
        isOwner: true,
        connected: true,
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

  // ── Join Room (also handles Reconnection) ────────────
  socket.on('joinRoom', ({ roomName, password, color }: {
    roomName: string; password: string; color: string;
  }) => {
    if (!authenticatedUser) {
      return socket.emit('lobbyError', 'Önce giriş yapmalısınız.');
    }
    const username = authenticatedUser;

    if (!roomName || !password || !color) {
      return socket.emit('lobbyError', 'Tüm alanlar doldurulmalıdır.');
    }

    const room = rooms[roomName];
    if (!room) {
      return socket.emit('lobbyError', 'Bu isimde bir oda bulunamadı.');
    }
    if (room.password !== password) {
      return socket.emit('lobbyError', 'Oda şifresi yanlış.');
    }

    const existingMember = room.members.find(m => m.username === username);

    if (existingMember) {
      // Player is reconnecting
      if (existingMember.connected) {
        return socket.emit('lobbyError', 'Bu kullanıcı adı zaten aktif olarak bağlı.');
      }

      // Cancel disconnect timer
      if (existingMember.disconnectTimer) {
        clearTimeout(existingMember.disconnectTimer);
        existingMember.disconnectTimer = undefined;
      }

      // Re-associate socket
      existingMember.socketId = socket.id;
      existingMember.connected = true;
      currentRoom = roomName;
      socket.join(roomName);

      console.log(`${username} RECONNECTED to room "${roomName}" (${socket.id})`);

      socket.emit('roomJoined', { roomName, isOwner: existingMember.isOwner });

      // If game is in progress, send the current game state
      if (room.started && room.gameState) {
        socket.emit('gameStarted', room.gameState);
      }

      io.to(roomName).emit('lobbyUpdate', buildLobbyUpdate(roomName));
      return;
    }

    // ── NEW PLAYER joining ──
    if (room.started) {
      return socket.emit('lobbyError', 'Bu odada oyun zaten başlamış. Yeni oyuncu kabul edilmiyor.');
    }
    if (room.members.length >= 4) {
      return socket.emit('lobbyError', 'Oda dolu (maksimum 4 oyuncu).');
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
      connected: true,
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

    const hexes = generateRandomMap();
    const graph = generateBoardGraph(hexes, 65);

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
    if (!currentRoom || !rooms[currentRoom]) return;

    const room = rooms[currentRoom];
    const member = room.members.find(m => m.socketId === socket.id);
    if (!member) return;

    const roomNameCopy = currentRoom; // Capture for closures

    if (room.started) {
      // ── Game in progress: mark as disconnected, start 30s timer ──
      member.connected = false;
      console.log(`${member.username} disconnected from game in "${roomNameCopy}". Starting 30s timeout.`);

      io.to(roomNameCopy).emit('lobbyUpdate', buildLobbyUpdate(roomNameCopy));
      io.to(roomNameCopy).emit('playerDisconnected', {
        username: member.username,
        timeoutMs: DISCONNECT_TIMEOUT_MS,
      });

      member.disconnectTimer = setTimeout(() => {
        console.log(`${member.username} did not reconnect within 30s in "${roomNameCopy}". Skipping their turn.`);

        // Check if it's their turn and skip
        const state = room.gameState;
        if (state) {
          const pid = findPlayerIdByUsername(state, member.username);
          const currentPid = state.turnOrder[state.currentTurnIndex];
          if (pid === currentPid) {
            skipDisconnectedPlayerTurn(roomNameCopy);
          }
        }

        member.disconnectTimer = undefined;
      }, DISCONNECT_TIMEOUT_MS);

    } else {
      // ── Lobby phase: remove the member entirely ──
      const memberIndex = room.members.indexOf(member);
      const wasOwner = member.isOwner;
      room.members.splice(memberIndex, 1);

      if (room.members.length === 0) {
        delete rooms[roomNameCopy];
        console.log(`Room "${roomNameCopy}" deleted (empty).`);
      } else {
        if (wasOwner && room.members.length > 0) {
          room.members[0].isOwner = true;
          console.log(`Ownership of "${roomNameCopy}" transferred to ${room.members[0].username}`);
        }
        io.to(roomNameCopy).emit('lobbyUpdate', buildLobbyUpdate(roomNameCopy));
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
