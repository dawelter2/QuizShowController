import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createUser, createRoom, joinRoomAsPlayer, listRoomPlayers, createRound,
  updateScoreCache, updateRoom, punishPlayer, getPlayerPenalty, isPlayerPunished,
  countRounds, getRoundLimit, isRoundLimitReached,
} from '../dist/store/queries.js';
import {
  DEFAULT_BUZZER_ORDER_CONFIG, GAME_TYPES, getGameType, defaultConfigFor,
  normalizeRoomConfig,
} from '../dist/store/game-types.js';

let counter = 0;

function makeUser(name) {
  counter++;
  return createUser(name, `sess-${randomUUID()}`);
}

function makeRoom(config = {}, type = 'buzzer-order') {
  const presenter = makeUser(`Host ${counter}`);
  return createRoom(presenter.id, 'Sala de teste', '', type, {
    ...DEFAULT_BUZZER_ORDER_CONFIG,
    ...config,
  });
}

function makePlayer(roomId, name) {
  const user = makeUser(name);
  const result = joinRoomAsPlayer(roomId, user.id);
  assert.equal(result.ok, true);
  return user;
}

function startRound(roomId) {
  return createRound(roomId, countRounds(roomId) + 1, '', '');
}

test('catálogo expõe "Ordem das Buzinas" com os defaults atuais', () => {
  assert.equal(GAME_TYPES.length, 1);
  const type = getGameType('buzzer-order');
  assert.ok(type);
  assert.equal(type.name, 'Ordem das Buzinas');

  const defaults = defaultConfigFor('buzzer-order');
  assert.deepEqual(defaults, {
    quiz_url: '',
    total_rounds: 0,
    points_exact: 3,
    points_near: 1,
    penalty_type: 'rounds',
    penalty_rounds: 3,
    penalty_points: 3,
  });

  // A metadata do formulário usa exatamente os mesmos defaults.
  for (const field of type.fields) {
    assert.equal(field.default, defaults[field.key], `default de ${field.key}`);
  }

  // Campos condicionais de punição existem para os dois tipos.
  const penaltyFields = type.fields.filter(f => f.show_when?.key === 'penalty_type');
  assert.deepEqual(
    penaltyFields.map(f => `${f.key}=${f.show_when.equals}`).sort(),
    ['penalty_points=points', 'penalty_rounds=rounds'],
  );
});

test('normaliza configuração válida e preenche campos ausentes', () => {
  const result = normalizeRoomConfig('buzzer-order', {
    quiz_url: ' https://www.youtube.com/watch?v=abc12345678 ',
    total_rounds: '5',
    points_exact: 4,
    points_near: 0,
    penalty_type: 'points',
    penalty_points: 2,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config, {
    quiz_url: 'https://www.youtube.com/watch?v=abc12345678',
    total_rounds: 5,
    points_exact: 4,
    points_near: 0,
    penalty_type: 'points',
    penalty_rounds: 3, // ausente → default do tipo
    penalty_points: 2,
  });

  const empty = normalizeRoomConfig('buzzer-order', {});
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.config, DEFAULT_BUZZER_ORDER_CONFIG);

  // Número em branco (só espaços) usa o default em vez de virar 0.
  const blankNumber = normalizeRoomConfig('buzzer-order', { total_rounds: '   ' });
  assert.equal(blankNumber.ok, true);
  assert.equal(blankNumber.config.total_rounds, 0);
});

test('rejeita tipo, URL, números e opções inválidas', () => {
  const invalidCases = [
    { type: 'nao-existe', config: {} },
    { type: 'buzzer-order', config: [] },
    { type: 'buzzer-order', config: { quiz_url: 'youtube.com/watch?v=abc' } },
    { type: 'buzzer-order', config: { quiz_url: 'ftp://example.com/video' } },
    { type: 'buzzer-order', config: { quiz_url: 'https://example.com/quiz' } },
    { type: 'buzzer-order', config: { quiz_url: 'https://www.youtube.com/playlist?list=abc' } },
    { type: 'buzzer-order', config: { quiz_url: [] } },
    { type: 'buzzer-order', config: { total_rounds: -1 } },
    { type: 'buzzer-order', config: { total_rounds: 201 } },
    { type: 'buzzer-order', config: { total_rounds: 1.5 } },
    { type: 'buzzer-order', config: { total_rounds: [5] } },
    { type: 'buzzer-order', config: { points_exact: 0 } },
    { type: 'buzzer-order', config: { points_exact: true } },
    { type: 'buzzer-order', config: { points_near: 'muitos' } },
    { type: 'buzzer-order', config: { penalty_type: 'banimento' } },
    { type: 'buzzer-order', config: { penalty_type: ['rounds'] } },
    { type: 'buzzer-order', config: { penalty_rounds: 0 } },
    { type: 'buzzer-order', config: { penalty_points: 101 } },
  ];

  for (const { type, config } of invalidCases) {
    const result = normalizeRoomConfig(type, config);
    assert.equal(result.ok, false, `deveria rejeitar ${JSON.stringify({ type, config })}`);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0);
  }
});

test('sala criada sem configuração mantém o comportamento antigo', () => {
  const presenter = makeUser('Host padrão');
  const room = createRoom(presenter.id, 'Padrão', '');

  assert.equal(room.type, 'buzzer-order');
  assert.deepEqual(room.config, DEFAULT_BUZZER_ORDER_CONFIG);

  const custom = makeRoom({ total_rounds: 5, points_exact: 7, points_near: 2 });
  assert.equal(custom.config.total_rounds, 5);
  assert.equal(custom.config.points_exact, 7);
  assert.equal(custom.config.points_near, 2);

  const updated = updateRoom(custom.id, { config: { ...custom.config, points_exact: 9 } });
  assert.equal(updated.config.points_exact, 9);
});

test('punição por rodadas respeita a quantidade configurada', () => {
  const room = makeRoom({ penalty_type: 'rounds', penalty_rounds: 2 });
  const ana = makePlayer(room.id, 'Ana');

  startRound(room.id); // rodada 1: erro
  const result = punishPlayer(room.id, ana.id);
  assert.equal(result.ok, true);
  assert.equal(result.penalty_type, 'rounds');
  assert.equal(result.penalty.rounds_remaining, 2);
  assert.equal(result.penalty.start_round, 2);
  assert.equal(result.penalty.until_round, 3);
  assert.equal(isPlayerPunished(room.id, ana.id), false);

  startRound(room.id); // rodada 2
  assert.equal(isPlayerPunished(room.id, ana.id), true);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 2);

  startRound(room.id); // rodada 3
  assert.equal(isPlayerPunished(room.id, ana.id), true);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 1);

  startRound(room.id); // rodada 4: liberado
  assert.equal(isPlayerPunished(room.id, ana.id), false);
  assert.equal(getPlayerPenalty(room.id, ana.id), null);
});

test('punição por pontos desconta do placar sem bloquear a buzina', () => {
  const room = makeRoom({ penalty_type: 'points', penalty_points: 5 });
  const ana = makePlayer(room.id, 'Ana');
  updateScoreCache(room.id, ana.id, 10);

  startRound(room.id);
  const result = punishPlayer(room.id, ana.id);

  assert.equal(result.ok, true);
  assert.equal(result.penalty_type, 'points');
  assert.equal(result.penalty, null);
  assert.equal(result.points_subtracted, 5);
  assert.equal(result.new_score, 5);

  let entry = listRoomPlayers(room.id).find(p => p.user_id === ana.id);
  assert.equal(entry.score_cache, 5);
  assert.equal(entry.penalty, null);
  assert.equal(isPlayerPunished(room.id, ana.id), false);

  // Cada "Errou" desconta de novo (sem piso em zero).
  const again = punishPlayer(room.id, ana.id);
  assert.equal(again.ok, true);
  assert.equal(again.new_score, 0);

  entry = listRoomPlayers(room.id).find(p => p.user_id === ana.id);
  assert.equal(entry.score_cache, 0);
});

test('limite de rodadas configurado encerra a partida', () => {
  const limited = makeRoom({ total_rounds: 2 });
  assert.equal(getRoundLimit(limited.id), 2);
  assert.equal(isRoundLimitReached(limited.id), false);

  startRound(limited.id);
  assert.equal(isRoundLimitReached(limited.id), false);

  startRound(limited.id);
  assert.equal(isRoundLimitReached(limited.id), true);

  // Salas sem limite (0) nunca atingem o limite.
  const unlimited = makeRoom({ total_rounds: 0 });
  startRound(unlimited.id);
  startRound(unlimited.id);
  startRound(unlimited.id);
  assert.equal(getRoundLimit(unlimited.id), 0);
  assert.equal(isRoundLimitReached(unlimited.id), false);
});
