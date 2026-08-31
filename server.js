import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { configureCoreGameLifecycle, initRoomManager } from './server/shared/roomManager.js';
import { initWebRTCSignaling } from './server/shared/webrtcSignaling.js';
import { initSTTBroadcast } from './server/shared/sttBroadcast.js';
import { registerLoveLetterController } from './server/games/loveLetterController.js';
import { broadcastRoomState } from './server/shared/roomManager.js';
import { createLoveLetterService } from './server/core/LoveLetterService.js';
import { initializeRoomRepository } from './server/core/RoomRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

const app = express();
const server = http.createServer(app);

// Socket.io Server with Connection State Recovery
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes grace recovery
    skipMiddlewares: true,
  },
});

app.use(cors());
app.use(express.json());

// Serve static React build files in production if dist exists
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

const PORT = process.env.PORT || 3001;

// -------------------------------------------------------------
// REST API Endpoints (All prefix with /api)
// -------------------------------------------------------------

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Wish Boardgame Cafe',
    version: '2.0.0-ts-core',
    time: new Date().toISOString(),
  });
});

// SPA Fallback for client-side routing
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// -------------------------------------------------------------
// Socket.io Game Modules & Shared Handlers Initialization
// -------------------------------------------------------------

export const loveLetterService = createLoveLetterService(io, { broadcastRoomState });

async function startServer() {
  await initializeRoomRepository();
  initRoomManager(io);
  configureCoreGameLifecycle({
    pause: (roomCode, playerId) => loveLetterService.pauseRoom(roomCode, playerId),
    resume: (roomCode) => loveLetterService.resumeRoom(roomCode),
    forfeit: (roomCode, playerId) => loveLetterService.handleCommand(roomCode, { type: 'FORFEIT', playerId }),
  });
  initWebRTCSignaling(io);
  initSTTBroadcast(io);
  registerLoveLetterController(io, loveLetterService);

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🎲 Wish Boardgame Cafe Server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

startServer().catch((error) => {
  console.error('Failed to initialize the room repository:', error);
  process.exit(1);
});
