import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState, initialGameState } from '../src/game/gameState';
import * as gameEngine from '../src/game/gameEngine';
import { generateRandomMap, generateBoardGraph } from '../src/utils/mapGenerator';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());

// Serve static files from the React build
const distPath = path.resolve('dist');
console.log(`Checking dist folder at: ${distPath}`);
if (fs.existsSync(distPath)) {
  console.log('Dist folder found!');
  const files = fs.readdirSync(distPath);
  console.log(`Files in dist: ${files.join(', ')}`);
} else {
  console.error('ERROR: Dist folder NOT found. Build might have failed or ran on wrong directory.');
}

app.use(express.static(distPath));

// Final catch-all for SPA (must be LAST)
app.use((req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log(`Fallback: Checking index.html at ${indexPath}`);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`Error: index.html not found in dist. Current directory: ${process.cwd()}`);
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow local dev
    methods: ["GET", "POST"]
  }
});

const ROOMS_FILE = path.resolve('server', 'rooms.json');
let rooms: Record<string, GameState> = {};

if (fs.existsSync(ROOMS_FILE)) {
  try {
    const data = fs.readFileSync(ROOMS_FILE, 'utf-8');
    rooms = JSON.parse(data);
    console.log(`Loaded ${Object.keys(rooms).length} rooms from disk.`);
  } catch (e) {
    console.error("Failed to load rooms.json", e);
  }
}

function saveRooms() {
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', (roomId: string) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      const hexes = generateRandomMap();
      const graph = generateBoardGraph(hexes, 65);
      rooms[roomId] = {
        ...initialGameState,
        board: { hexes, graph }
      };
      saveRooms();
    }
    // Send state to the guy who joined
    socket.emit('gameState', rooms[roomId]);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('action', ({ roomId, type, payload }: { roomId: string, type: string, payload: any }) => {
    const state = rooms[roomId];
    if (!state) return;

    let newState = state;
    try {
      switch (type) {
        case 'rollDice':
          newState = gameEngine.rollDice(state);
          break;
        case 'endTurn':
          newState = gameEngine.endTurn(state);
          break;
        case 'buildRoad':
          newState = gameEngine.buildRoad(state, payload.edgeId, payload.playerId);
          break;
        case 'buildSettlement':
          newState = gameEngine.buildSettlement(state, payload.nodeId, payload.playerId);
          break;
        case 'upgradeCity':
          newState = gameEngine.upgradeCity(state, payload.nodeId, payload.playerId);
          break;
        case 'buyDevCard':
          newState = gameEngine.buyDevelopmentCard(state, payload.playerId);
          break;
        case 'playKnight':
          newState = gameEngine.playKnightCard(state, payload.playerId);
          break;
        case 'moveRobber':
          newState = gameEngine.moveRobber(state, payload.hexId, payload.stealFromId, payload.playerId);
          break;
        case 'tradeWithBank':
          newState = gameEngine.tradeWithBank(state, payload.playerId, payload.offer, payload.ask);
          break;
      }
    } catch (e) {
      console.error(`Error processing action ${type}:`, e);
    }

    if (newState !== state) {
      rooms[roomId] = newState;
      io.to(roomId).emit('gameState', newState); // Broadcast to everyone in room
      saveRooms();
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Catan Multiplayer Server running on port ${PORT}`);
});
