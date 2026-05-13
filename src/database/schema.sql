PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- TABELAS DO JOGO
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
    session_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK(length(code) = 4),
    presenter_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'playing', 'finished')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
);

CREATE TABLE IF NOT EXISTS room_players (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('presenter', 'player')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    left_at TEXT,
    score_cache INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK(round_number > 0),
    media_url TEXT NOT NULL DEFAULT '',
    correct_answer TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'done')),
    started_at TEXT,
    ended_at TEXT
);

CREATE TABLE IF NOT EXISTS buzzer_events (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES users(id),
    position INTEGER NOT NULL CHECK(position > 0),
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL DEFAULT '',
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    judgment TEXT NOT NULL DEFAULT 'none' CHECK(judgment IN ('na_mosca', 'raspando', 'errado', 'none')),
    score_delta INTEGER NOT NULL DEFAULT 0,
    judged_by TEXT REFERENCES users(id),
    judged_at TEXT,
    UNIQUE (round_id, player_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_room_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_presenter ON rooms(presenter_id);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON room_players(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_room ON rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_buzzer_round ON buzzer_events(round_id);
CREATE INDEX IF NOT EXISTS idx_buzzer_order ON buzzer_events(round_id, position);
CREATE INDEX IF NOT EXISTS idx_answers_round ON answers(round_id);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_id);

-- ============================================================
-- TABELA DE AGREGADOS (métricas futuras)
-- ============================================================

CREATE TABLE IF NOT EXISTS player_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_rooms INTEGER NOT NULL DEFAULT 0,
    total_rounds INTEGER NOT NULL DEFAULT 0,
    total_na_mosca INTEGER NOT NULL DEFAULT 0,
    total_raspando INTEGER NOT NULL DEFAULT 0,
    total_erros INTEGER NOT NULL DEFAULT 0,
    total_pontos INTEGER NOT NULL DEFAULT 0,
    avg_buzzer_time_ms INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
