import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createUser, createRoom, joinRoomAsPlayer, listRoomPlayers, createRound,
  countRounds, setRoundEligiblePlayers, registerAnswer, getAnswerOrder,
  maybeRevealAnswers, revealRoundAnswers, gradeRoundAnswers, listRoundAnswers,
  removePlayerFromRoom, findRoundById, getRoomScores,
} from '../dist/store/queries.js';
import {
  DEFAULT_ANSWERS_CONFIG, GAME_TYPES, getGameType, defaultConfigFor,
  normalizeRoomConfig, answersConfigFor,
} from '../dist/store/game-types.js';

let counter = 0;

function makeUser(name) {
  counter++;
  return createUser(name, `sess-${randomUUID()}`);
}

function makeAnswersRoom(config = {}) {
  const presenter = makeUser(`Host ${counter}`);
  return createRoom(presenter.id, 'Sala de respostas', '', 'answers', {
    ...DEFAULT_ANSWERS_CONFIG,
    ...config,
  });
}

function makePlayer(roomId, name) {
  const user = makeUser(name);
  const result = joinRoomAsPlayer(roomId, user.id);
  assert.equal(result.ok, true);
  return user;
}

function startEligibleRound(roomId, players) {
  const round = createRound(roomId, countRounds(roomId) + 1, '', '');
  setRoundEligiblePlayers(round.id, players.map(p => p.id));
  return round;
}

test('catálogo expõe o tipo Respostas com defaults e formulário', () => {
  assert.equal(GAME_TYPES.length, 2);
  const type = getGameType('answers');
  assert.ok(type);
  assert.equal(type.name, 'Respostas');

  assert.deepEqual(defaultConfigFor('answers'), {
    video_url: '',
    option_count: 4,
    option_style: 'alpha',
    points_first: 3,
    points_later: 1,
  });

  for (const field of type.fields) {
    assert.equal(field.default, DEFAULT_ANSWERS_CONFIG[field.key], `default de ${field.key}`);
  }

  const keys = type.fields.map(f => f.key);
  assert.deepEqual(keys, [
    'video_url', 'option_count', 'option_style', 'points_first', 'points_later',
  ]);
});

test('normaliza configuração do tipo Respostas', () => {
  const defaults = normalizeRoomConfig('answers', {});
  assert.equal(defaults.ok, true);
  assert.deepEqual(defaults.config, DEFAULT_ANSWERS_CONFIG);

  const custom = normalizeRoomConfig('answers', {
    video_url: ' https://www.youtube.com/watch?v=abc12345678 ',
    option_count: '6',
    option_style: 'numeric',
    points_first: '5',
    points_later: 0,
  });
  assert.equal(custom.ok, true);
  assert.deepEqual(custom.config, {
    video_url: 'https://www.youtube.com/watch?v=abc12345678',
    option_count: 6,
    option_style: 'numeric',
    points_first: 5,
    points_later: 0,
  });

  const invalid = [
    { option_count: 0 },
    { option_count: 7 },
    { option_count: 1.5 },
    { option_style: 'romano' },
    { points_first: 0 },
    { points_later: 101 },
    { video_url: 'https://example.com/video' },
  ];
  for (const config of invalid) {
    const result = normalizeRoomConfig('answers', config);
    assert.equal(result.ok, false, `deveria rejeitar ${JSON.stringify(config)}`);
  }

  // answersConfigFor preenche campos ausentes sem alterar os válidos.
  assert.deepEqual(answersConfigFor({ option_count: 2 }), {
    ...DEFAULT_ANSWERS_CONFIG,
    option_count: 2,
  });
});

test('registra respostas em ordem e mantém alternativas ocultas até revelar', () => {
  const room = makeAnswersRoom();
  const ana = makePlayer(room.id, 'Ana');
  const bob = makePlayer(room.id, 'Bob');
  const carol = makePlayer(room.id, 'Carol');
  const round = startEligibleRound(room.id, [ana, bob, carol]);

  const first = registerAnswer(round.id, ana.id, 2);
  assert.equal(first.ok, true);
  assert.equal(first.event.position, 1);

  const second = registerAnswer(round.id, bob.id, 1);
  assert.equal(second.ok, true);
  assert.equal(second.event.position, 2);

  // Duplicada é recusada (não pode trocar a escolha).
  const duplicate = registerAnswer(round.id, ana.id, 3);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'DUPLICATE');

  const hidden = getAnswerOrder(round.id);
  assert.deepEqual(hidden.map(a => a.option), [null, null]);
  assert.deepEqual(hidden.map(a => a.player_name), ['Ana', 'Bob']);

  // Jogador que entrou depois do snapshot não responde nesta rodada.
  const dave = makePlayer(room.id, 'Dave');
  const late = registerAnswer(round.id, dave.id, 1);
  assert.equal(late.ok, false);
  assert.equal(late.code, 'NOT_ELIGIBLE');

  assert.equal(revealRoundAnswers(round.id), true);
  assert.equal(revealRoundAnswers(round.id), false);
  const revealed = getAnswerOrder(round.id);
  assert.deepEqual(revealed.map(a => a.option), [2, 1]);
});

test('revela automaticamente quando todos os elegíveis responderam', () => {
  const room = makeAnswersRoom();
  const ana = makePlayer(room.id, 'Ana');
  const bob = makePlayer(room.id, 'Bob');
  const round = startEligibleRound(room.id, [ana, bob]);

  registerAnswer(round.id, ana.id, 1);
  assert.equal(maybeRevealAnswers(room.id, round.id), false);
  assert.equal(findRoundById(round.id).answers_revealed, false);

  registerAnswer(round.id, bob.id, 3);
  assert.equal(maybeRevealAnswers(room.id, round.id), true);
  assert.equal(findRoundById(round.id).answers_revealed, true);
  assert.deepEqual(getAnswerOrder(round.id).map(a => a.option), [1, 3]);
});

test('revelar manualmente libera a correção mesmo com jogador AFK', () => {
  const room = makeAnswersRoom();
  const ana = makePlayer(room.id, 'Ana');
  const afk = makePlayer(room.id, 'Afk');
  const round = startEligibleRound(room.id, [ana, afk]);

  registerAnswer(round.id, ana.id, 2);
  assert.equal(maybeRevealAnswers(room.id, round.id), false);

  assert.equal(revealRoundAnswers(round.id), true);
  const graded = gradeRoundAnswers(round.id, 2, 3, 1);
  assert.equal(graded.ok, true);
  const scores = getRoomScores(room.id);
  assert.equal(scores.find(s => s.player_id === ana.id).score, 3);
  assert.equal(scores.find(s => s.player_id === afk.id).score, 0);
});

test('corrige a rodada: primeiro acerto vale mais que os demais', () => {
  const room = makeAnswersRoom({ points_first: 3, points_later: 1 });
  const ana = makePlayer(room.id, 'Ana');
  const bob = makePlayer(room.id, 'Bob');
  const carol = makePlayer(room.id, 'Carol');
  const round = startEligibleRound(room.id, [ana, bob, carol]);

  // Ana acerta primeiro; Bob erra; Carol acerta depois.
  registerAnswer(round.id, ana.id, 2);   // posição 1, correta
  registerAnswer(round.id, bob.id, 1);   // posição 2, errada
  registerAnswer(round.id, carol.id, 2); // posição 3, correta
  // Bob respondeu antes de Carol, mas errou: não consome o "primeiro acerto".
  assert.equal(maybeRevealAnswers(room.id, round.id), true);

  const graded = gradeRoundAnswers(round.id, 2, 3, 1);
  assert.equal(graded.ok, true);

  const answers = getAnswerOrder(round.id);
  assert.deepEqual(answers.map(a => [a.player_name, a.is_correct, a.awarded_points]), [
    ['Ana', true, 3],
    ['Bob', false, 0],
    ['Carol', true, 1],
  ]);

  const scores = getRoomScores(room.id);
  assert.equal(scores.find(s => s.player_id === ana.id).score, 3);
  assert.equal(scores.find(s => s.player_id === bob.id).score, 0);
  assert.equal(scores.find(s => s.player_id === carol.id).score, 1);

  // Correção é única.
  const again = gradeRoundAnswers(round.id, 2, 3, 1);
  assert.equal(again.ok, false);
  assert.equal(again.code, 'ALREADY_GRADED');
  assert.equal(getRoomScores(room.id).find(s => s.player_id === ana.id).score, 3);
});

test('pontos "depois" configurados como zero mantêm o acerto sem somar', () => {
  const room = makeAnswersRoom({ points_first: 5, points_later: 0 });
  const ana = makePlayer(room.id, 'Ana');
  const bob = makePlayer(room.id, 'Bob');
  const round = startEligibleRound(room.id, [ana, bob]);

  registerAnswer(round.id, ana.id, 1);
  registerAnswer(round.id, bob.id, 1);
  maybeRevealAnswers(room.id, round.id);
  gradeRoundAnswers(round.id, 1, 5, 0);

  const answers = getAnswerOrder(round.id);
  assert.deepEqual(answers.map(a => a.awarded_points), [5, 0]);
  assert.deepEqual(answers.map(a => a.is_correct), [true, true]);
  assert.equal(getRoomScores(room.id).find(s => s.player_id === bob.id).score, 0);
});

test('saída de um pendente permite a revelação automática', () => {
  const room = makeAnswersRoom();
  const ana = makePlayer(room.id, 'Ana');
  const bob = makePlayer(room.id, 'Bob');
  const round = startEligibleRound(room.id, [ana, bob]);

  registerAnswer(round.id, ana.id, 1);
  assert.equal(maybeRevealAnswers(room.id, round.id), false);

  removePlayerFromRoom(room.id, bob.id);
  assert.equal(maybeRevealAnswers(room.id, round.id), true);
  assert.deepEqual(listRoundAnswers(round.id).map(a => a.player_id), [ana.id]);
  assert.equal(listRoomPlayers(room.id).some(p => p.user_id === bob.id), false);
});
