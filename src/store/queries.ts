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
  score_cache: number;
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

const roundsMap = new Map<string, Round>();
const roomRoundsMap = new Map<string, string[]>(); // room_id → [round_id]

const buzzersMap = new Map<string, BuzzerEvent[]>(); // round_id → ordered events
const answersMap = new Map<string, Answer>();        // `${round_id}:${player_id}` → Answer

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
  addPlayerToRoom(id, presenterId, 'presenter');
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

// ─── Room Players ────────────────────────────────────

export function addPlayerToRoom(roomId: string, userId: string, role: 'presenter' | 'player' = 'player') {
  const user = usersById.get(userId);
  if (!user) return;

  let players = roomPlayersMap.get(roomId);
  if (!players) { players = new Map(); roomPlayersMap.set(roomId, players); }

  const existing = players.get(userId);
  if (existing) {
    existing.left_at = null;
    if (existing.role !== 'presenter') existing.role = role;
  } else {
    players.set(userId, {
      room_id: roomId, user_id: userId, name: user.name, role,
      joined_at: new Date().toISOString(), left_at: null, score_cache: 0,
    });
  }
  touchRoom(roomId);
}

export function removePlayerFromRoom(roomId: string, userId: string) {
  const player = roomPlayersMap.get(roomId)?.get(userId);
  if (player) {
    player.left_at = new Date().toISOString();
    touchRoom(roomId);
  }
}

export function listRoomPlayers(roomId: string): (RoomPlayer & { name: string })[] {
  const players = roomPlayersMap.get(roomId);
  if (!players) return [];
  return Array.from(players.values())
    .filter(p => p.left_at === null)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
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
  // Reset de scores
  const players = roomPlayersMap.get(roomId);
  if (players) {
    for (const player of players.values()) {
      player.score_cache = 0;
    }
  }

  // Reset de rodadas
  roomRoundsMap.set(roomId, []);
  touchRoom(roomId);
}
