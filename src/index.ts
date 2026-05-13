import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { router as apiRoutes } from './api/routes.js';
import { setupSocketEvents } from './ws/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Static files (frontend)
app.use(express.static(join(__dirname, 'public')));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// WebSocket
setupSocketEvents(io);

httpServer.listen(PORT, () => {
  console.log(`🎬 Quiz Show Controller rodando em http://localhost:${PORT}`);
});
