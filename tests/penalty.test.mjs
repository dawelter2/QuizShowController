import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createUser, createRoom, joinRoomAsPlayer, listRoomPlayers, createRound,
  updateScoreCache, resetRoomGame, kickPlayerFromRoom,
  punishPlayer, getPlayerPenalty, isPlayerPunished,
  getCurrentRoundNumber, countRounds,
  bindPlayerSocket, unbindPlayerSocket, PENALTY_ROUNDS,
} from '../dist/store/queries.js';

let counter = 0;

function makeUser(name) {
  counter++;
  return createUser(name, `sess-${randomUUID()}`);
}

function makeRoom(title = 'Sala de punição') {
  const presenter = makeUser(`Host ${counter}`);
  return createRoom(presenter.id, title, '');
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

// Simula um jogador que já esteve conectado e agora está offline.
function markSeenOnline(roomId, userId) {
  const socketId = `sock-${randomUUID()}`;
  bindPlayerSocket(roomId, userId, socketId);
  unbindPlayerSocket(roomId, userId, socketId);
}

test('punição não altera pontos e começa na próxima rodada', () => {
  const room = makeRoom();
  const ana = makePlayer(room.id, 'Ana');
  updateScoreCache(room.id, ana.id, 10);

  startRound(room.id); // rodada 1
  const result = punishPlayer(room.id, ana.id);

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.penalty.active, false);
  assert.equal(result.ok && result.penalty.starts_next_round, true);
  assert.equal(result.ok && result.penalty.rounds_remaining, PENALTY_ROUNDS);
  assert.equal(result.ok && result.penalty.start_round, 2);
  assert.equal(result.ok && result.penalty.until_round, 4);

  const entry = listRoomPlayers(room.id).find(p => p.user_id === ana.id);
  assert.equal(entry.score_cache, 10);
  assert.deepEqual(entry.penalty, {
    active: false,
    starts_next_round: true,
    rounds_remaining: 3,
    start_round: 2,
    until_round: 4,
  });

  // A rodada do erro não bloqueia a buzina (a punição começa depois).
  assert.equal(isPlayerPunished(room.id, ana.id), false);
});

test('bloqueia exatamente as 3 rodadas seguintes (3, 2, 1)', () => {
  const room = makeRoom();
  const ana = makePlayer(room.id, 'Ana');

  startRound(room.id); // rodada 1: erro
  punishPlayer(room.id, ana.id);

  startRound(room.id); // rodada 2
  assert.equal(getCurrentRoundNumber(room.id), 2);
  assert.equal(isPlayerPunished(room.id, ana.id), true);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 3);

  startRound(room.id); // rodada 3
  assert.equal(isPlayerPunished(room.id, ana.id), true);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 2);

  startRound(room.id); // rodada 4
  assert.equal(isPlayerPunished(room.id, ana.id), true);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 1);

  startRound(room.id); // rodada 5: liberado
  assert.equal(isPlayerPunished(room.id, ana.id), false);
  assert.equal(getPlayerPenalty(room.id, ana.id), null);
});

test('reaplicar a punição é idempotente (não soma nem reinicia)', () => {
  const room = makeRoom();
  const ana = makePlayer(room.id, 'Ana');

  startRound(room.id); // rodada 1
  punishPlayer(room.id, ana.id);
  punishPlayer(room.id, ana.id);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.until_round, 4);

  startRound(room.id); // rodada 2
  punishPlayer(room.id, ana.id);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.until_round, 4);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 3);

  startRound(room.id); // rodada 3
  punishPlayer(room.id, ana.id);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.until_round, 4);
  assert.equal(getPlayerPenalty(room.id, ana.id)?.rounds_remaining, 2);
});

test('resetar a partida limpa as punições', () => {
  const room = makeRoom();
  const ana = makePlayer(room.id, 'Ana');

  startRound(room.id);
  punishPlayer(room.id, ana.id);
  assert.notEqual(getPlayerPenalty(room.id, ana.id), null);

  resetRoomGame(room.id);

  assert.equal(getPlayerPenalty(room.id, ana.id), null);
  const entry = listRoomPlayers(room.id).find(p => p.user_id === ana.id);
  assert.equal(entry.penalty, null);

  startRound(room.id); // rodada 1 do novo jogo
  assert.equal(isPlayerPunished(room.id, ana.id), false);
});

test('adoção de sessão preserva a punição', () => {
  const room = makeRoom();
  const oldUser = makePlayer(room.id, 'Ana');
  updateScoreCache(room.id, oldUser.id, 5);

  startRound(room.id);
  punishPlayer(room.id, oldUser.id);
  markSeenOnline(room.id, oldUser.id);

  const freshUser = makeUser('Ana');
  const result = joinRoomAsPlayer(room.id, freshUser.id);

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.adopted, true);
  assert.equal(result.ok && result.user.id, oldUser.id);

  const entry = listRoomPlayers(room.id).find(p => p.user_id === oldUser.id);
  assert.equal(entry.score_cache, 5);
  assert.equal(entry.penalty?.starts_next_round, true);
  assert.equal(getPlayerPenalty(room.id, oldUser.id)?.active, false);
});

test('só jogador ativo e com rodada criada pode ser punido', () => {
  const presenter = makeUser('Host');
  const room = createRoom(presenter.id, 'Teste', '');

  const noRound = punishPlayer(room.id, presenter.id);
  assert.equal(noRound.ok, false);
  assert.equal(!noRound.ok && noRound.code, 'PLAYER_NOT_FOUND');

  const ana = makePlayer(room.id, 'Ana');
  const noRound2 = punishPlayer(room.id, ana.id);
  assert.equal(noRound2.ok, false);
  assert.equal(!noRound2.ok && noRound2.code, 'NO_ROUND');

  startRound(room.id);
  const presenterPunish = punishPlayer(room.id, presenter.id);
  assert.equal(presenterPunish.ok, false);
  assert.equal(!presenterPunish.ok && presenterPunish.code, 'PLAYER_NOT_FOUND');

  kickPlayerFromRoom(room.id, ana.id);
  const kicked = punishPlayer(room.id, ana.id);
  assert.equal(kicked.ok, false);
  assert.equal(!kicked.ok && kicked.code, 'PLAYER_NOT_FOUND');

  const unknown = punishPlayer('sala-inexistente', ana.id);
  assert.equal(unknown.ok, false);
  assert.equal(!unknown.ok && unknown.code, 'ROOM_NOT_FOUND');
});
