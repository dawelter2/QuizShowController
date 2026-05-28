import { v4 as uuid } from 'uuid';
import { getDb } from './connection.js';

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

// ─── Users ───────────────────────────────────────────

export function createUser(name: string, sessionId: string): User {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, name, session_id, created_at, last_seen)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, sessionId, now, now);
  return { id, name, session_id: sessionId, created_at: now, last_seen: now };
}

export function findUserBySession(sessionId: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE session_id = ?').get(sessionId) as User | undefined;
}

export function updateLastSeen(userId: string) {
  const db = getDb();
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(new Date().toISOString(), userId);
}

// ─── Room code generation ───────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Rooms ───────────────────────────────────────────

export function createRoom(presenterId: string, title: string, notes: string): Room {
  const db = getDb();
  const id = uuid();
  const code = generateRoomCode();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO rooms (id, code, presenter_id, title, notes, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', ?)
  `).run(id, code, presenterId, title, notes, now);

  addPlayerToRoom(id, presenterId, 'presenter');

  return { id, code, presenter_id: presenterId, title, notes, status: 'waiting', created_at: now, ended_at: null };
}

export function findRoomByCode(code: string): Room | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM rooms WHERE UPPER(code) = UPPER(?)').get(code) as Room | undefined;
}

export function findRoomById(id: string): Room | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as Room | undefined;
}

export function updateRoom(id: string, data: { title?: string; notes?: string }): Room | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }

  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  return findRoomById(id);
}

export function closeRoom(id: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE rooms SET status = 'finished', ended_at = ? WHERE id = ?").run(now, id);
}

// ─── Room Players ───────────────────────────────────

export function addPlayerToRoom(roomId: string, userId: string, role: 'presenter' | 'player' = 'player') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO room_players (room_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(room_id, user_id) DO UPDATE SET
      left_at = NULL,
      role = CASE WHEN room_players.role = 'presenter' THEN 'presenter' ELSE excluded.role END
  `).run(roomId, userId, role, now);
}

export function removePlayerFromRoom(roomId: string, userId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE room_players SET left_at = ? WHERE room_id = ? AND user_id = ?').run(now, roomId, userId);
}

export function listRoomPlayers(roomId: string): (RoomPlayer & { name: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT rp.*, u.name FROM room_players rp
    JOIN users u ON u.id = rp.user_id
    WHERE rp.room_id = ? AND rp.left_at IS NULL
    ORDER BY rp.joined_at
  `).all(roomId) as (RoomPlayer & { name: string })[];
}

export function updateScoreCache(roomId: string, userId: string, score: number) {
  const db = getDb();
  db.prepare('UPDATE room_players SET score_cache = ? WHERE room_id = ? AND user_id = ?').run(score, roomId, userId);
}

// ─── Rounds ─────────────────────────────────────────

export function createRound(roomId: string, roundNumber: number, mediaUrl: string, correctAnswer: string): Round {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO rounds (id, room_id, round_number, media_url, correct_answer, status, started_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(id, roomId, roundNumber, mediaUrl, correctAnswer, now);
  return { id, room_id: roomId, round_number: roundNumber, media_url: mediaUrl, correct_answer: correctAnswer, status: 'active', started_at: now, ended_at: null };
}

export function closeRound(id: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE rounds SET status = 'done', ended_at = ? WHERE id = ?").run(now, id);
}

export function findCurrentRound(roomId: string): Round | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM rounds WHERE room_id = ? AND status IN ('waiting', 'active') ORDER BY round_number DESC LIMIT 1").get(roomId) as Round | undefined;
}

export function countRounds(roomId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM rounds WHERE room_id = ?').get(roomId) as { count: number };
  return row.count;
}

// ─── Buzzer Events ──────────────────────────────────

export function registerBuzz(roundId: string, playerId: string): BuzzerEvent | null {
  const db = getDb();

  const alreadyBuzzed = db.prepare(
    'SELECT id FROM buzzer_events WHERE round_id = ? AND player_id = ?'
  ).get(roundId, playerId);
  if (alreadyBuzzed) return null;

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), 0) as max_pos FROM buzzer_events WHERE round_id = ?'
  ).get(roundId) as { max_pos: number };

  const id = uuid();
  const pos = maxPos.max_pos + 1;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO buzzer_events (id, round_id, player_id, position, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, roundId, playerId, pos, now);

  return { id, round_id: roundId, player_id: playerId, position: pos, timestamp: now };
}

export function getBuzzerOrder(roundId: string): (BuzzerEvent & { player_name: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT be.*, u.name as player_name FROM buzzer_events be
    JOIN users u ON u.id = be.player_id
    WHERE be.round_id = ?
    ORDER BY be.position
  `).all(roundId) as (BuzzerEvent & { player_name: string })[];
}

// ─── Answers ────────────────────────────────────────

export function upsertAnswer(roundId: string, playerId: string, text: string): Answer {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO answers (id, round_id, player_id, text, submitted_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(round_id, player_id) DO UPDATE SET
      text = excluded.text,
      submitted_at = excluded.submitted_at
  `).run(uuid(), roundId, playerId, text, now);

  return db.prepare(
    'SELECT * FROM answers WHERE round_id = ? AND player_id = ?'
  ).get(roundId, playerId) as Answer;
}

export function judgeAnswer(roundId: string, playerId: string, judgment: Answer['judgment'], scoreDelta: number, judgeId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE answers SET judgment = ?, score_delta = ?, judged_by = ?, judged_at = ?
    WHERE round_id = ? AND player_id = ?
  `).run(judgment, scoreDelta, judgeId, now, roundId, playerId);
}

export function getRoundAnswers(roundId: string): (Answer & { player_name: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, u.name as player_name FROM answers a
    JOIN users u ON u.id = a.player_id
    WHERE a.round_id = ?
  `).all(roundId) as (Answer & { player_name: string })[];
}

// ─── Scores ─────────────────────────────────────────

export function getRoomScores(roomId: string): { player_id: string; player_name: string; score: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT rp.user_id as player_id, u.name as player_name, rp.score_cache as score
    FROM room_players rp
    JOIN users u ON u.id = rp.user_id
    WHERE rp.room_id = ? AND rp.left_at IS NULL AND rp.role = 'player'
    ORDER BY rp.score_cache DESC
  `).all(roomId) as { player_id: string; player_name: string; score: number }[];
}
