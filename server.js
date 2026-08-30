import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initRoomManager } from './server/shared/roomManager.js';
import { initWebRTCSignaling } from './server/shared/webrtcSignaling.js';
import { initSTTBroadcast } from './server/shared/sttBroadcast.js';
import { registerLoveLetter } from './server/games/love-letter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
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
  res.json({ status: 'ok', service: 'Wish Boardgame Cafe', time: new Date().toISOString() });
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

initRoomManager(io);
initWebRTCSignaling(io);
initSTTBroadcast(io);
registerLoveLetter(io);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎲 Wish Boardgame Cafe Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
