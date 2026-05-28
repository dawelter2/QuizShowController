import { Router, Request, Response } from 'express';
import {
  createUser, findUserBySession, updateLastSeen,
  createRoom, findRoomByCode, findRoomById, updateRoom, closeRoom,
  addPlayerToRoom, removePlayerFromRoom, listRoomPlayers,
} from '../database/queries.js';

export const router = Router();

// ─── Auth ───────────────────────────────────────────

router.post('/auth', (req: Request, res: Response) => {
  const { name, session_id } = req.body;

  if (session_id) {
    const existing = findUserBySession(session_id);
    if (existing) {
      updateLastSeen(existing.id);
      res.json({ user: existing });
      return;
    }
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Nome é obrigatório' });
    return;
  }

  const newSessionId = crypto.randomUUID();
  const user = createUser(name.trim().slice(0, 50), newSessionId);
  res.json({ user });
});

// ─── Rooms ──────────────────────────────────────────

router.post('/rooms', (req: Request, res: Response) => {
  const { user_id, title, notes } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'user_id é obrigatório' });
    return;
  }

  const room = createRoom(user_id, title || '', notes || '');
  res.json({ room });
});

router.get('/rooms/:code', (req: Request, res: Response) => {
  const room = findRoomByCode(req.params.code as string);
  if (!room) {
    res.status(404).json({ error: 'Sala não encontrada' });
    return;
  }
  const players = listRoomPlayers(room.id);
  res.json({ room: { ...room, player_count: players.filter(p => p.role === 'player').length } });
});

router.put('/rooms/:id', (req: Request, res: Response) => {
  const { title, notes } = req.body;
  const room = updateRoom(req.params.id as string, { title, notes });
  if (!room) {
    res.status(404).json({ error: 'Sala não encontrada' });
    return;
  }
  res.json({ room });
});

router.delete('/rooms/:id', (req: Request, res: Response) => {
  const room = findRoomById(req.params.id as string);
  if (!room) {
    res.status(404).json({ error: 'Sala não encontrada' });
    return;
  }
  closeRoom(req.params.id as string);
  res.json({ ok: true });
});

// ─── Room Players ───────────────────────────────────

router.get('/rooms/:id/players', (req: Request, res: Response) => {
  const players = listRoomPlayers(req.params.id as string);
  res.json({ players });
});

router.post('/rooms/:id/players', (req: Request, res: Response) => {
  const { user_id } = req.body;
  if (!user_id) {
    res.status(400).json({ error: 'user_id é obrigatório' });
    return;
  }
  addPlayerToRoom(req.params.id as string, user_id, 'player');
  res.json({ ok: true });
});

router.delete('/rooms/:id/players/:userId', (req: Request, res: Response) => {
  removePlayerFromRoom(req.params.id as string, req.params.userId as string);
  res.json({ ok: true });
});
