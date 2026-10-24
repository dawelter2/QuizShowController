import { v4 as uuid } from 'uuid';

// ─── Types ───────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  session_id: string;
  created_at: string;
  last_seen: string;
};

export type Room = {
  id: string;
  code: string;
  presenter_id: string;
  title: string;
  notes: string;
  status: 'waiting' | 'playing' | 'finished';
  created_at: string;
  ended_at: string | null;
  last_activity_at: string;
};

export type RoomPlayer = {
  room_id: string;
  user_id: string;
  role: 'presenter' | 'player';
  joined_at: string;
  left_at: string | null;
  kicked_at: string | null;
  claimed_at: string;
  last_online_at: string | null;
  score_cache: number;
};

export type RoomPlayerView = RoomPlayer & {
  name: string;
  online: boolean;
  is_duplicate: boolean;
  player_code: string;
};

export type Round = {
  id: string;
  room_id: string;
  round_number: number;
  media_url: string;
  correct_answer: string;
  status: 'waiting' | 'active' | 'done';
  started_at: string | null;
  ended_at: string | null;
};

export type BuzzerEvent = {
  id: string;
  round_id: string;
  player_id: string;
  position: number;
  timestamp: string;
};

export type Answer = {
  id: string;
  round_id: string;
  player_id: string;
  text: string;
  submitted_at: string;
  judgment: 'na_mosca' | 'raspando' | 'errado' | 'none';
  score_delta: number;
  judged_by: string | null;
  judged_at: string | null;
};

// ─── State ───────────────────────────────────────────

const usersById = new Map<string, User>();
const sessionIndex = new Map<string, string>(); // session_id → user_id

const roomsMap = new Map<string, Room>();
const roomCodeIndex = new Map<string, string>(); // UPPER(code) → room_id

// room_id → Map<user_id, RoomPlayer & { name }>
const roomPlayersMap = new Map<string, Map<string, RoomPlayer & { name: string }>>();

// room_id → user_id → socket_ids
const presenceMap = new Map<string, Map<string, Set<string>>>();

const roundsMap = new Map<string, Round>();
const roomRoundsMap = new Map<string, string[]>(); // room_id → [round_id]

const buzzersMap = new Map<string, BuzzerEvent[]>(); // round_id → ordered events
const answersMap = new Map<string, Answer>();        // `${round_id}:${player_id}` → Answer

// Janela em que uma entrada recém-criada (ainda sem socket) reserva o nome.
const CLAIM_TTL_MS = 10_000;

// ─── Names ───────────────────────────────────────────

export function normalizePlayerName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function sanitizePlayerName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (clean.length === 0 || clean.length > 50) return null;
  return clean;
}

export function playerCode(userId: string): string {
  return userId.replace(/-/g, '').slice(-4).toUpperCase();
}

// ─── Users ───────────────────────────────────────────

export function createUser(name: string, sessionId: string): User {
  const id = uuid();
  const now = new Date().toISOString();
  const user: User = { id, name, session_id: sessionId, created_at: now, last_seen: now };
  usersById.set(id, user);
  sessionIndex.set(sessionId, id);
  return user;
}

export function findUserBySession(sessionId: string): User | undefined {
  const id = sessionIndex.get(sessionId);
  return id ? usersById.get(id) : undefined;
}

export function updateLastSeen(userId: string) {
  const user = usersById.get(userId);
  if (user) user.last_seen = new Date().toISOString();
}

export function renameUser(userId: string, name: string): User | undefined {
  const user = usersById.get(userId);
  if (!user) return undefined;
  user.name = name;
  for (const players of roomPlayersMap.values()) {
    const player = players.get(userId);
    if (player) player.name = name;
  }
  touchAllUserRooms(userId);
  return user;
}

function touchAllUserRooms(userId: string) {
  for (const [roomId, players] of roomPlayersMap) {
    if (players.has(userId)) touchRoom(roomId);
  }
}

// ─── Room code generation ────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Rooms ───────────────────────────────────────────

export function createRoom(presenterId: string, title: string, notes: string): Room {
  const id = uuid();
  let code: string;
  do { code = generateRoomCode(); } while (roomCodeIndex.has(code));

  const now = new Date().toISOString();
  const room: Room = { id, code, presenter_id: presenterId, title, notes, status: 'waiting', created_at: now, ended_at: null, last_activity_at: now };
  roomsMap.set(id, room);
  console.log(`[DEBUG] Sala criada: ${title} (${code})`);
  roomCodeIndex.set(code, id);
  roomPlayersMap.set(id, new Map());
  roomRoundsMap.set(id, []);
  addMembership(id, presenterId, 'presenter');
  return room;
}

export function findRoomByCode(code: string): Room | undefined {
  const id = roomCodeIndex.get(code.toUpperCase());
  return id ? roomsMap.get(id) : undefined;
}

export function findRoomById(id: string): Room | undefined {
  return roomsMap.get(id);
}

export function listActiveRooms(): Room[] {
  return Array.from(roomsMap.values())
    .filter(r => r.status === 'waiting' || r.status === 'playing')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function updateRoom(id: string, data: { title?: string; notes?: string }): Room | undefined {
  const room = roomsMap.get(id);
  if (!room) return undefined;
  if (data.title !== undefined) room.title = data.title;
  if (data.notes !== undefined) room.notes = data.notes;
  touchRoom(id);
  return room;
}

export function closeRoom(id: string) {
  const room = roomsMap.get(id);
  if (room) { room.status = 'finished'; room.ended_at = new Date().toISOString(); }
}

export function touchRoom(roomId: string) {
  const room = roomsMap.get(roomId);
  if (room) room.last_activity_at = new Date().toISOString();
}

export function cleanupInactiveRooms(maxAgeHours: number) {
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  let closedCount = 0;

  for (const room of roomsMap.values()) {
    if (room.status === 'finished') continue;

    const lastActivity = new Date(room.last_activity_at).getTime();
    if (now - lastActivity > maxAgeMs) {
      closeRoom(room.id);
      closedCount++;
    }
  }

  if (closedCount > 0) {
    console.log(`[CLEANUP] ${closedCount} salas inativas foram encerradas.`);
  }
}

// ─── Presence ────────────────────────────────────────

export function bindPlayerSocket(roomId: string, userId: string, socketId: string) {
  let byUser = presenceMap.get(roomId);
  if (!byUser) { byUser = new Map(); presenceMap.set(roomId, byUser); }

  let sockets = byUser.get(userId);
  if (!sockets) { sockets = new Set(); byUser.set(userId, sockets); }
  sockets.add(socketId);

  const player = roomPlayersMap.get(roomId)?.get(userId);
  if (player) player.last_online_at = new Date().toISOString();
}

export function unbindPlayerSocket(roomId: string, userId: string, socketId: string) {
  const byUser = presenceMap.get(roomId);
  if (!byUser) return;

  const sockets = byUser.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) byUser.delete(userId);
  if (byUser.size === 0) presenceMap.delete(roomId);
}

export function isPlayerOnline(roomId: string, userId: string): boolean {
  return (presenceMap.get(roomId)?.get(userId)?.size ?? 0) > 0;
}

export function listPlayerSocketIds(roomId: string, userId: string): string[] {
  return Array.from(presenceMap.get(roomId)?.get(userId) ?? []);
}

// ─── Room Players ────────────────────────────────────

function addMembership(roomId: string, userId: string, role: 'presenter' | 'player'): (RoomPlayer & { name: string }) | undefined {
  const user = usersById.get(userId);
  if (!user) return undefined;

  let players = roomPlayersMap.get(roomId);
  if (!players) { players = new Map(); roomPlayersMap.set(roomId, players); }

  const now = new Date().toISOString();
  const existing = players.get(userId);
  if (existing) {
    existing.left_at = null;
    existing.claimed_at = now;
    existing.name = user.name;
    if (existing.role !== 'presenter') existing.role = role;
    touchRoom(roomId);
    return existing;
  }

  const player: RoomPlayer & { name: string } = {
    room_id: roomId, user_id: userId, name: user.name, role,
    joined_at: now, left_at: null, kicked_at: null,
    claimed_at: now, last_online_at: null, score_cache: 0,
  };
  players.set(userId, player);
  touchRoom(roomId);
  return player;
}

export type JoinRoomResult =
  | { ok: true; user: User; adopted: boolean }
  | { ok: false; code: 'ROOM_NOT_FOUND' | 'USER_NOT_FOUND' | 'KICKED' | 'NAME_TAKEN'; message: string };

export function joinRoomAsPlayer(roomId: string, userId: string): JoinRoomResult {
  const room = roomsMap.get(roomId);
  if (!room) return { ok: false, code: 'ROOM_NOT_FOUND', message: 'Sala não encontrada' };

  const user = usersById.get(userId);
  if (!user) return { ok: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' };

  // Apresentador: garante membership, sem validação de nome de jogador.
  if (room.presenter_id === userId) {
    addMembership(roomId, userId, 'presenter');
    return { ok: true, user, adopted: false };
  }

  const players = roomPlayersMap.get(roomId);
  const existing = players?.get(userId);
  if (existing) {
    if (existing.kicked_at) {
      return { ok: false, code: 'KICKED', message: 'Você foi removido desta sala pelo apresentador' };
    }
    existing.left_at = null;
    existing.claimed_at = new Date().toISOString();
    existing.name = user.name;
    touchRoom(roomId);
    return { ok: true, user, adopted: false };
  }

  const sameName = listActivePlayerEntries(roomId).filter(
    p => normalizePlayerName(p.name) === normalizePlayerName(user.name),
  );

  if (sameName.length > 0) {
    if (sameName.some(p => isEntryOccupied(roomId, p))) {
      return {
        ok: false, code: 'NAME_TAKEN',
        message: `Já existe um jogador "${user.name}" nesta sala. Escolha outro nome.`,
      };
    }

    const candidate = sameName
      .filter(p => !p.kicked_at)
      .sort((a, b) => b.score_cache - a.score_cache || a.joined_at.localeCompare(b.joined_at))[0];

    // Só reutiliza a identidade se o usuário novo não pertence a outra sala
    // (evita apagar um usuário que também é apresentador/jogador em outro lugar).
    if (candidate && !hasOtherRoomBindings(userId)) {
      const canonical = usersById.get(candidate.user_id);
      if (!canonical) return { ok: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' };

      const now = new Date().toISOString();
      candidate.left_at = null;
      candidate.claimed_at = now;
      candidate.name = user.name;
      sessionIndex.set(user.session_id, candidate.user_id);
      usersById.delete(user.id);

      touchRoom(roomId);
      console.log(`[PLAYER] adopt room=${roomId} user=${user.id} -> ${candidate.user_id} name=${user.name}`);
      return { ok: true, user: canonical, adopted: true };
    }

    return {
      ok: false, code: 'NAME_TAKEN',
      message: `Já existe um jogador "${user.name}" nesta sala. Escolha outro nome.`,
    };
  }

  addMembership(roomId, userId, 'player');
  return { ok: true, user, adopted: false };
}

function listActivePlayerEntries(roomId: string): (RoomPlayer & { name: string })[] {
  const players = roomPlayersMap.get(roomId);
  if (!players) return [];
  return Array.from(players.values()).filter(p => p.left_at === null && p.role === 'player');
}

function isEntryOccupied(roomId: string, player: RoomPlayer): boolean {
  if (isPlayerOnline(roomId, player.user_id)) return true;
  // Entrada nova, ainda sem socket: reserva o nome por alguns segundos.
  return player.last_online_at === null && Date.now() - new Date(player.claimed_at).getTime() < CLAIM_TTL_MS;
}

function hasOtherRoomBindings(userId: string): boolean {
  for (const room of roomsMap.values()) {
    if (room.presenter_id === userId) return true;
  }
  for (const players of roomPlayersMap.values()) {
    if (players.has(userId)) return true;
  }
  return false;
}

export function isActiveRoomMember(roomId: string, userId: string): boolean {
  const player = roomPlayersMap.get(roomId)?.get(userId);
  return !!player && player.left_at === null;
}

export function isNameTakenInRoom(roomId: string, name: string, exceptUserId?: string): boolean {
  const key = normalizePlayerName(name);
  const players = roomPlayersMap.get(roomId);
  if (!players) return false;

  for (const player of players.values()) {
    if (player.role !== 'player' || player.left_at !== null) continue;
    if (exceptUserId && player.user_id === exceptUserId) continue;
    if (normalizePlayerName(player.name) === key) return true;
  }
  return false;
}

export function removePlayerFromRoom(roomId: string, userId: string) {
  const player = roomPlayersMap.get(roomId)?.get(userId);
  if (player && player.role === 'player') {
    player.left_at = new Date().toISOString();
    touchRoom(roomId);
  }
}

export type KickPlayerResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'PRESENTER'; message: string };

export function kickPlayerFromRoom(roomId: string, userId: string): KickPlayerResult {
  const room = roomsMap.get(roomId);
  if (!room) return { ok: false, code: 'NOT_FOUND', message: 'Sala não encontrada' };

  const player = roomPlayersMap.get(roomId)?.get(userId);
  if (!player || player.left_at !== null) {
    return { ok: false, code: 'NOT_FOUND', message: 'Jogador não está na sala' };
  }
  if (player.role === 'presenter' || userId === room.presenter_id) {
    return { ok: false, code: 'PRESENTER', message: 'O apresentador não pode ser removido' };
  }

  const now = new Date().toISOString();
  player.left_at = now;
  player.kicked_at = now;

  // Remove respostas do jogador nas rodadas desta sala (evita fantasma no painel).
  const roomRoundIds = new Set(roomRoundsMap.get(roomId) ?? []);
  for (const [key, answer] of answersMap) {
    if (answer.player_id === userId && roomRoundIds.has(answer.round_id)) {
      answersMap.delete(key);
    }
  }

  touchRoom(roomId);
  return { ok: true };
}

export function listRoomPlayers(roomId: string): RoomPlayerView[] {
  const players = roomPlayersMap.get(roomId);
  if (!players) return [];

  const active = Array.from(players.values()).filter(p => p.left_at === null);

  const nameCounts = new Map<string, number>();
  for (const player of active) {
    if (player.role !== 'player') continue;
    const key = normalizePlayerName(player.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  return active
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
    .map(p => ({
      ...p,
      online: isPlayerOnline(roomId, p.user_id),
      is_duplicate: p.role === 'player' && (nameCounts.get(normalizePlayerName(p.name)) ?? 0) > 1,
      player_code: playerCode(p.user_id),
    }));
}

export function updateScoreCache(roomId: string, userId: string, score: number) {
  const player = roomPlayersMap.get(roomId)?.get(userId);
  if (player) {
    player.score_cache = score;
    touchRoom(roomId);
  }
}

// ─── Rounds ──────────────────────────────────────────

export function createRound(roomId: string, roundNumber: number, mediaUrl: string, correctAnswer: string): Round {
  const id = uuid();
  const now = new Date().toISOString();
  const round: Round = { id, room_id: roomId, round_number: roundNumber, media_url: mediaUrl, correct_answer: correctAnswer, status: 'active', started_at: now, ended_at: null };
  roundsMap.set(id, round);
  const ids = roomRoundsMap.get(roomId) ?? [];
  ids.push(id);
  roomRoundsMap.set(roomId, ids);
  buzzersMap.set(id, []);
  touchRoom(roomId);
  return round;
}

export function closeRound(id: string) {
  const round = roundsMap.get(id);
  if (round) {
    round.status = 'done';
    round.ended_at = new Date().toISOString();
    touchRoom(round.room_id);
  }
}

export function findCurrentRound(roomId: string): Round | undefined {
  const ids = roomRoundsMap.get(roomId) ?? [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const round = roundsMap.get(ids[i]);
    if (round && (round.status === 'waiting' || round.status === 'active')) return round;
  }
  return undefined;
}

export function countRounds(roomId: string): number {
  return (roomRoundsMap.get(roomId) ?? []).length;
}

// ─── Buzzer Events ───────────────────────────────────

export function registerBuzz(roundId: string, playerId: string): BuzzerEvent | null {
  const round = roundsMap.get(roundId);
  if (!round) return null;

  const events = buzzersMap.get(roundId) ?? [];
  if (events.some(e => e.player_id === playerId)) return null;
  const event: BuzzerEvent = { id: uuid(), round_id: roundId, player_id: playerId, position: events.length + 1, timestamp: new Date().toISOString() };
  events.push(event);
  buzzersMap.set(roundId, events);
  touchRoom(round.room_id);
  return event;
}

export function getBuzzerOrder(roundId: string): (BuzzerEvent & { player_name: string })[] {
  return (buzzersMap.get(roundId) ?? []).map(e => ({
    ...e,
    player_name: usersById.get(e.player_id)?.name ?? e.player_id,
  }));
}

// ─── Answers ─────────────────────────────────────────

export function upsertAnswer(roundId: string, playerId: string, text: string): Answer {
  const round = roundsMap.get(roundId);
  const key = `${roundId}:${playerId}`;
  const existing = answersMap.get(key);
  if (existing) {
    existing.text = text;
    existing.submitted_at = new Date().toISOString();
    if (round) touchRoom(round.room_id);
    return existing;
  }
  const answer: Answer = { id: uuid(), round_id: roundId, player_id: playerId, text, submitted_at: new Date().toISOString(), judgment: 'none', score_delta: 0, judged_by: null, judged_at: null };
  answersMap.set(key, answer);
  if (round) touchRoom(round.room_id);
  return answer;
}

export function judgeAnswer(roundId: string, playerId: string, judgment: Answer['judgment'], scoreDelta: number, judgeId: string) {
  const round = roundsMap.get(roundId);
  const answer = answersMap.get(`${roundId}:${playerId}`);
  if (answer) {
    answer.judgment = judgment;
    answer.score_delta = scoreDelta;
    answer.judged_by = judgeId;
    answer.judged_at = new Date().toISOString();
    if (round) touchRoom(round.room_id);
  }
}

export function getRoundAnswers(roundId: string): (Answer & { player_name: string })[] {
  return Array.from(answersMap.values())
    .filter(a => a.round_id === roundId)
    .map(a => ({ ...a, player_name: usersById.get(a.player_id)?.name ?? a.player_id }));
}

// ─── Scores ──────────────────────────────────────────

export function getRoomScores(roomId: string): { player_id: string; player_name: string; score: number }[] {
  const players = roomPlayersMap.get(roomId);
  if (!players) return [];
  return Array.from(players.values())
    .filter(p => p.left_at === null && p.role === 'player')
    .sort((a, b) => b.score_cache - a.score_cache)
    .map(p => ({ player_id: p.user_id, player_name: p.name, score: p.score_cache }));
}

export function resetRoomGame(roomId: string) {
  // Reset de scores e de remoções (escape hatch para remoção acidental)
  const players = roomPlayersMap.get(roomId);
  if (players) {
    for (const player of players.values()) {
      player.score_cache = 0;
      player.kicked_at = null;
    }
  }

  // Reset de rodadas
  roomRoundsMap.set(roomId, []);
  touchRoom(roomId);
}
