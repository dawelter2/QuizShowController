import { Router, Request, Response } from 'express';
import {
  createUser, findUserBySession, updateLastSeen,
  createRoom, findRoomByCode, findRoomById, listActiveRooms, updateRoom, closeRoom,
  listRoomPlayers, joinRoomAsPlayer, kickPlayerFromRoom,
  renameUser, sanitizePlayerName,
} from '../store/queries.js';

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

// Renomear sem perder a sessão/identidade (usado pelo lobby quando o nome
// escolhido já está em uso na sala).
router.patch('/auth', (req: Request, res: Response) => {
  const { session_id, name } = req.body ?? {};

  if (!session_id) {
    res.status(400).json({ error: 'session_id é obrigatório' });
    return;
  }

  const user = findUserBySession(session_id);
  if (!user) {
    res.status(404).json({ error: 'Sessão não encontrada' });
    return;
  }

  const cleanName = sanitizePlayerName(name);
  if (!cleanName) {
    res.status(400).json({ error: 'Nome inválido (use de 1 a 50 caracteres)' });
    return;
  }

  const updated = renameUser(user.id, cleanName);
  updateLastSeen(user.id);
  res.json({ user: updated });
});

// ─── Rooms ──────────────────────────────────────────

router.get('/rooms', (req: Request, res: Response) => {
  const rooms = listActiveRooms();
  console.log(`[DEBUG] Listando ${rooms.length} salas ativas`);
  const roomsWithPlayers = rooms.map((room: any) => {
    const players = listRoomPlayers(room.id);
    return {
      ...room,
      player_count: players.filter((p: any) => p.role === 'player').length
    };
  });
  res.json({ rooms: roomsWithPlayers });
});

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

  const result = joinRoomAsPlayer(req.params.id as string, user_id);
  if (!result.ok) {
    const status = result.code === 'NAME_TAKEN' ? 409 : result.code === 'KICKED' ? 403 : 404;
    res.status(status).json({ ok: false, error: result.message, code: result.code });
    return;
  }

  res.json({ ok: true, user: result.user, adopted: result.adopted });
});

router.delete('/rooms/:id/players/:userId', (req: Request, res: Response) => {
  const room = findRoomById(req.params.id as string);
  if (!room) {
    res.status(404).json({ error: 'Sala não encontrada' });
    return;
  }

  const { presenter_id } = req.body ?? {};
  if (presenter_id !== room.presenter_id) {
    res.status(403).json({ error: 'Apenas o apresentador pode remover jogadores' });
    return;
  }

  const result = kickPlayerFromRoom(room.id, req.params.userId as string);
  if (!result.ok) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json({ ok: true });
});
