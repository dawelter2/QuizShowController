import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createUser, createRoom, findUserBySession, joinRoomAsPlayer, listRoomPlayers,
  bindPlayerSocket, unbindPlayerSocket, isPlayerOnline,
  updateScoreCache, removePlayerFromRoom, kickPlayerFromRoom,
  resetRoomGame, renameUser, isNameTakenInRoom,
  normalizePlayerName, sanitizePlayerName,
  createRound, upsertAnswer, getRoundAnswers,
} from '../dist/store/queries.js';

let counter = 0;

function makeUser(name) {
  counter++;
  return createUser(name, `sess-${randomUUID()}`);
}

function makeRoom(title = 'Sala de teste') {
  const presenter = makeUser(`Host ${counter}`);
  return createRoom(presenter.id, title, '');
}

function activePlayers(roomId) {
  return listRoomPlayers(roomId).filter(p => p.role === 'player');
}

// Simula um jogador que já esteve conectado e agora está offline.
function markSeenOnline(roomId, userId) {
  const socketId = `sock-${randomUUID()}`;
  bindPlayerSocket(roomId, userId, socketId);
  unbindPlayerSocket(roomId, userId, socketId);
}

test('normalizePlayerName ignora caixa e espaços', () => {
  assert.equal(normalizePlayerName('  Ana   Maria '), 'ana maria');
  assert.equal(normalizePlayerName('ANA'), normalizePlayerName('ana'));
});

test('sanitizePlayerName valida nome exibido', () => {
  assert.equal(sanitizePlayerName('  Ana  '), 'Ana');
  assert.equal(sanitizePlayerName('   '), null);
  assert.equal(sanitizePlayerName('a'.repeat(51)), null);
  assert.equal(sanitizePlayerName(42), null);
});

test('mesmo usuário entrando duas vezes gera uma única entrada', () => {
  const room = makeRoom();
  const user = makeUser('Ana');

  assert.equal(joinRoomAsPlayer(room.id, user.id).ok, true);
  assert.equal(joinRoomAsPlayer(room.id, user.id).ok, true);
  assert.equal(activePlayers(room.id).length, 1);
});

test('nome em uso por jogador online é recusado', () => {
  const room = makeRoom();
  const ana = makeUser('Ana');
  joinRoomAsPlayer(room.id, ana.id);
  bindPlayerSocket(room.id, ana.id, `sock-${randomUUID()}`);

  const other = makeUser('Ana');
  const result = joinRoomAsPlayer(room.id, other.id);

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'NAME_TAKEN');
  assert.equal(activePlayers(room.id).length, 1);
});

test('duas entradas novas com o mesmo nome: a segunda é recusada', () => {
  const room = makeRoom();
  const first = makeUser('Ana');
  joinRoomAsPlayer(room.id, first.id);

  const second = makeUser('Ana');
  const result = joinRoomAsPlayer(room.id, second.id);

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'NAME_TAKEN');
});

test('mesmo nome com entrada offline é adotado e preserva pontos', () => {
  const room = makeRoom();
  const oldUser = makeUser('Ana');
  joinRoomAsPlayer(room.id, oldUser.id);
  updateScoreCache(room.id, oldUser.id, 7);
  markSeenOnline(room.id, oldUser.id);

  const freshUser = makeUser('Ana');
  const result = joinRoomAsPlayer(room.id, freshUser.id);

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.adopted, true);
  assert.equal(result.ok && result.user.id, oldUser.id);
  assert.equal(findUserBySession(freshUser.session_id)?.id, oldUser.id);

  const players = activePlayers(room.id);
  assert.equal(players.length, 1);
  assert.equal(players[0].user_id, oldUser.id);
  assert.equal(players[0].score_cache, 7);
});

test('presença usa refcount por socket', () => {
  const room = makeRoom();
  const user = makeUser('Ana');
  joinRoomAsPlayer(room.id, user.id);

  bindPlayerSocket(room.id, user.id, 's1');
  bindPlayerSocket(room.id, user.id, 's2');
  assert.equal(isPlayerOnline(room.id, user.id), true);

  unbindPlayerSocket(room.id, user.id, 's1');
  assert.equal(isPlayerOnline(room.id, user.id), true);

  unbindPlayerSocket(room.id, user.id, 's2');
  assert.equal(isPlayerOnline(room.id, user.id), false);
});

test('sair e voltar com a mesma sessão mantém uma entrada e o score', () => {
  const room = makeRoom();
  const user = makeUser('Ana');
  joinRoomAsPlayer(room.id, user.id);
  updateScoreCache(room.id, user.id, 5);
  markSeenOnline(room.id, user.id);

  removePlayerFromRoom(room.id, user.id);
  assert.equal(activePlayers(room.id).length, 0);

  const result = joinRoomAsPlayer(room.id, user.id);
  assert.equal(result.ok, true);

  const players = activePlayers(room.id);
  assert.equal(players.length, 1);
  assert.equal(players[0].score_cache, 5);
});

test('remoção tira do placar, apaga respostas e bloqueia a mesma sessão', () => {
  const room = makeRoom();
  const user = makeUser('Ana');
  joinRoomAsPlayer(room.id, user.id);

  const round = createRound(room.id, 1, '', '');
  upsertAnswer(round.id, user.id, 'resposta');

  const kick = kickPlayerFromRoom(room.id, user.id);
  assert.equal(kick.ok, true);
  assert.equal(activePlayers(room.id).length, 0);
  assert.equal(getRoundAnswers(round.id).length, 0);

  const rejoin = joinRoomAsPlayer(room.id, user.id);
  assert.equal(rejoin.ok, false);
  assert.equal(!rejoin.ok && rejoin.code, 'KICKED');
});

test('resetar a partida desfaz a remoção', () => {
  const room = makeRoom();
  const user = makeUser('Ana');
  joinRoomAsPlayer(room.id, user.id);
  kickPlayerFromRoom(room.id, user.id);

  resetRoomGame(room.id);

  const result = joinRoomAsPlayer(room.id, user.id);
  assert.equal(result.ok, true);
  assert.equal(activePlayers(room.id).length, 1);
});

test('novo usuário pode usar o nome de um jogador removido', () => {
  const room = makeRoom();
  const removed = makeUser('Ana');
  joinRoomAsPlayer(room.id, removed.id);
  kickPlayerFromRoom(room.id, removed.id);

  const other = makeUser('Ana');
  const result = joinRoomAsPlayer(room.id, other.id);

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.adopted, false);
  assert.equal(activePlayers(room.id).length, 1);
});

test('não é possível remover o apresentador nem jogador fora da sala', () => {
  const presenter = makeUser('Host');
  const room = createRoom(presenter.id, 'Teste', '');

  const presenterResult = kickPlayerFromRoom(room.id, presenter.id);
  assert.equal(presenterResult.ok, false);
  assert.equal(!presenterResult.ok && presenterResult.code, 'PRESENTER');

  const unknownResult = kickPlayerFromRoom(room.id, 'nao-existe');
  assert.equal(unknownResult.ok, false);
  assert.equal(!unknownResult.ok && unknownResult.code, 'NOT_FOUND');
});

test('renameUser atualiza o membership e a checagem de conflito ignora o próprio', () => {
  const room = makeRoom();
  const ana = makeUser('Ana');
  const bia = makeUser('Bia');
  joinRoomAsPlayer(room.id, ana.id);
  joinRoomAsPlayer(room.id, bia.id);

  assert.equal(isNameTakenInRoom(room.id, 'ANA'), true);
  assert.equal(isNameTakenInRoom(room.id, 'ana', ana.id), false);

  renameUser(ana.id, 'Ana Maria');

  const renamed = activePlayers(room.id).find(p => p.user_id === ana.id);
  assert.equal(renamed?.name, 'Ana Maria');
  assert.equal(isNameTakenInRoom(room.id, 'ANA'), false);
  assert.equal(isNameTakenInRoom(room.id, 'Bia'), true);
  assert.equal(isNameTakenInRoom(room.id, 'Bia', bia.id), false);
});

test('duplicatas legadas são sinalizadas para o apresentador', () => {
  const room = makeRoom();
  const ana = makeUser('Ana');
  const bia = makeUser('Bia');
  joinRoomAsPlayer(room.id, ana.id);
  joinRoomAsPlayer(room.id, bia.id);

  // Bypassa a validação de entrada para simular dados antigos/duplicados.
  renameUser(bia.id, 'Ana');

  const players = activePlayers(room.id);
  assert.equal(players.length, 2);
  assert.ok(players.every(p => p.is_duplicate));
});
