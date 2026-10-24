import { Server, Socket } from 'socket.io';
import {
  findRoomById, listRoomPlayers,
  createRound, closeRound, findCurrentRound, countRounds,
  registerBuzz, getBuzzerOrder,
  upsertAnswer, judgeAnswer, getRoundAnswers,
  updateScoreCache, getRoomScores, resetRoomGame,
  joinRoomAsPlayer, removePlayerFromRoom, kickPlayerFromRoom,
  bindPlayerSocket, unbindPlayerSocket, listPlayerSocketIds,
  isActiveRoomMember, renameUser, isNameTakenInRoom, sanitizePlayerName,
} from '../store/queries.js';

type ClientData = {
  room_id?: string;
  user_id?: string;
};

const clientMap = new Map<string, ClientData>();

type Ack = ((res: any) => void) | undefined;

export function setupSocketEvents(io: Server) {
  io.on('connection', (socket: Socket) => {
    const roomId = socket.handshake.query.room_id as string | undefined;
    const userId = socket.handshake.query.user_id as string | undefined;

    console.log(`[WS] socket ${socket.id} connected: room=${roomId}, user=${userId}`);

    clientMap.set(socket.id, { room_id: roomId, user_id: userId });

    if (roomId && userId) {
      socket.join(roomId);
      // Só conta presença quem realmente é membro ativo da sala
      // (o socket sintético do OBS, por exemplo, não entra).
      if (isActiveRoomMember(roomId, userId)) {
        bindPlayerSocket(roomId, userId, socket.id);
      }
      console.log(`[WS] socket ${socket.id} joined room ${roomId}, emitting sala:status`);
      emitRoomStatus(io, roomId);
    } else {
      console.log(`[WS] socket ${socket.id} missing roomId or userId`);
    }

    // ─── Sala: entrar ───────────────────────────────

    socket.on('sala:entrar', (data: { room_id: string; user_id: string }, ack?: Ack) => {
      const result = joinRoomAsPlayer(data.room_id, data.user_id);
      if (!result.ok) {
        socket.emit('erro', { code: result.code, message: result.message });
        ack?.({ ok: false, code: result.code, error: result.message });
        return;
      }

      const previousUserId = clientMap.get(socket.id)?.user_id;
      if (previousUserId && previousUserId !== result.user.id) {
        unbindPlayerSocket(data.room_id, previousUserId, socket.id);
      }

      socket.join(data.room_id);
      clientMap.set(socket.id, { room_id: data.room_id, user_id: result.user.id });
      bindPlayerSocket(data.room_id, result.user.id, socket.id);

      if (result.adopted) {
        socket.emit('sessao:adotada', { user: result.user });
      }

      emitRoomStatus(io, data.room_id);
      io.to(data.room_id).emit('sala:jogadores', { players: listRoomPlayers(data.room_id) });
      ack?.({ ok: true, user: result.user, adopted: result.adopted });
    });

    // ─── Sala: sair ────────────────────────────────

    socket.on('sala:sair', (data: { room_id: string; user_id: string }, ack?: Ack) => {
      const current = clientMap.get(socket.id);
      if (!current || current.user_id !== data.user_id) {
        ack?.({ ok: false });
        return;
      }

      const roomToLeave = current.room_id ?? data.room_id;
      removePlayerFromRoom(roomToLeave, data.user_id);
      unbindPlayerSocket(roomToLeave, data.user_id, socket.id);
      socket.leave(roomToLeave);
      clientMap.delete(socket.id);
      // Status completo: além do painel do apresentador, atualiza o placar/OBS
      // (o jogador que saiu deixa de pontuar na sala).
      emitRoomStatus(io, roomToLeave);
      ack?.({ ok: true });
    });

    // ─── Jogador: renomear (no lugar) ──────────────

    socket.on('usuario:renomear', (data: { name: string }, ack?: Ack) => {
      const current = clientMap.get(socket.id);
      if (!current?.user_id) {
        ack?.({ ok: false, error: 'Sessão não encontrada' });
        return;
      }

      const name = sanitizePlayerName(data?.name);
      if (!name) {
        ack?.({ ok: false, error: 'Nome inválido (use de 1 a 50 caracteres)' });
        return;
      }

      if (current.room_id) {
        const room = findRoomById(current.room_id);
        const isPresenter = room?.presenter_id === current.user_id;
        // O apresentador não aparece na lista de jogadores; a unicidade de
        // nome vale apenas entre jogadores.
        if (!isPresenter && isNameTakenInRoom(current.room_id, name, current.user_id)) {
          const message = `Já existe um jogador "${name}" nesta sala`;
          socket.emit('erro', { code: 'NAME_TAKEN', message });
          ack?.({ ok: false, code: 'NAME_TAKEN', error: message });
          return;
        }
      }

      const user = renameUser(current.user_id, name);
      if (!user) {
        ack?.({ ok: false, error: 'Usuário não encontrado' });
        return;
      }

      if (current.room_id) {
        emitRoomStatus(io, current.room_id);
        io.to(current.room_id).emit('sala:jogadores', { players: listRoomPlayers(current.room_id) });
      }

      ack?.({ ok: true, user });
    });

    // ─── Jogador: remover (apresentador) ───────────

    socket.on('jogador:remover', (data: { room_id: string; user_id: string }, ack?: Ack) => {
      const room = findRoomById(data.room_id);
      const presenterId = clientMap.get(socket.id)?.user_id;

      if (!room || !presenterId || presenterId !== room.presenter_id) {
        const message = 'Apenas o apresentador pode remover jogadores';
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const targetSocketIds = listPlayerSocketIds(data.room_id, data.user_id);
      const result = kickPlayerFromRoom(data.room_id, data.user_id);
      if (!result.ok) {
        socket.emit('erro', { code: result.code, message: result.message });
        ack?.({ ok: false, error: result.message });
        return;
      }

      for (const socketId of targetSocketIds) {
        io.to(socketId).emit('sala:removido', {
          room_id: data.room_id,
          message: 'Você foi removido da sala pelo apresentador',
        });
        io.sockets.sockets.get(socketId)?.leave(data.room_id);
        unbindPlayerSocket(data.room_id, data.user_id, socketId);
        clientMap.delete(socketId);
      }

      console.log(`[PLAYER] kick room=${data.room_id} user=${data.user_id} by=${presenterId}`);
      emitRoomStatus(io, data.room_id);
      ack?.({ ok: true });
    });

    // ─── Rodada: iniciar ───────────────────────────

    socket.on('rodada:iniciar', (data: { room_id: string; media_url?: string; correct_answer?: string }) => {
      const room = findRoomById(data.room_id);
      if (!room) return;

      const roundNumber = countRounds(data.room_id) + 1;
      const round = createRound(
        data.room_id,
        roundNumber,
        data.media_url || '',
        data.correct_answer || '',
      );

      io.to(data.room_id).emit('rodada:iniciada', {
        round_id: round.id,
        round_number: round.round_number,
        media_url: round.media_url,
      });

      // Atualiza status da sala
      const players = listRoomPlayers(data.room_id);
      io.to(data.room_id).emit('sala:jogadores', { players });
    });

    // ─── Buzina: apertar ───────────────────────────

    socket.on('buzina:apertar', (data: { room_id: string; round_id: string; player_id: string }) => {
      const clientData = clientMap.get(socket.id);
      if (!clientData?.room_id || clientData.user_id !== data.player_id ||
          !isActiveRoomMember(clientData.room_id, data.player_id)) {
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message: 'Jogador não está ativo na sala' });
        return;
      }

      const event = registerBuzz(data.round_id, data.player_id);

      if (!event) {
        socket.emit('erro', { code: 'BUZZER_DUPLICADO', message: 'Você já apertou a buzina nesta rodada' });
        return;
      }

      const order = getBuzzerOrder(data.round_id);
      io.to(data.room_id).emit('buzina:ordem', {
        round_id: data.round_id,
        order: order.map(e => ({
          player_id: e.player_id,
          player_name: e.player_name,
          position: e.position,
          timestamp: e.timestamp,
        })),
      });
    });

    // ─── Resposta: escrever ────────────────────────

    socket.on('resposta:escrever', (data: { round_id: string; player_id: string; text: string }) => {
      const clientData = clientMap.get(socket.id);
      if (!clientData?.room_id || clientData.user_id !== data.player_id ||
          !isActiveRoomMember(clientData.room_id, data.player_id)) {
        return;
      }

      upsertAnswer(data.round_id, data.player_id, data.text);

      const room = findRoomById(clientData.room_id);
      if (!room) return;

      const player = listRoomPlayers(clientData.room_id).find(p => p.user_id === data.player_id);
      const playerName = player?.name ?? data.player_id;

      // Só manda resposta pro apresentador
      const presenterSocketId = getPresenterSocketId(io, clientData.room_id, room.presenter_id);
      if (presenterSocketId) {
        io.to(presenterSocketId).emit('resposta:atualizada', {
          round_id: data.round_id,
          player_id: data.player_id,
          player_name: playerName,
          text: data.text,
        });
      }
    });

    // ─── Pontos: alterar ───────────────────────────

    socket.on('pontos:alterar', (data: { room_id: string; round_id: string; player_id: string; score_delta: number; judgment: string }) => {
      const room = findRoomById(data.room_id);
      const judgeId = clientMap.get(socket.id)?.user_id;
      if (!room || !judgeId || judgeId !== room.presenter_id) {
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message: 'Apenas o apresentador pode alterar pontos' });
        return;
      }

      judgeAnswer(data.round_id, data.player_id, data.judgment as any, data.score_delta, judgeId);

      // Atualizar score_cache
      const players = listRoomPlayers(data.room_id);
      const player = players.find(p => p.user_id === data.player_id);
      const newScore = (player?.score_cache || 0) + data.score_delta;
      updateScoreCache(data.room_id, data.player_id, newScore);

      const scores = getRoomScores(data.room_id);
      io.to(data.room_id).emit('placar:atualizado', { room_id: data.room_id, scores });
    });

    // ─── Rodada: próxima ───────────────────────────

    socket.on('rodada:proxima', (data: { room_id: string; round_id: string }) => {
      closeRound(data.round_id);

      io.to(data.room_id).emit('rodada:proxima', {
        previous_round_id: data.round_id,
        message: 'Próxima rodada!',
      });
    });

    // ─── Jogo: resetar ─────────────────────────────

    socket.on('jogo:resetar', (data: { room_id: string }) => {
      resetRoomGame(data.room_id);
      console.log(`[WS] Sala ${data.room_id} resetada pelo apresentador`);
      emitRoomStatus(io, data.room_id);
    });

    // ─── Disconnect ────────────────────────────────

    socket.on('disconnect', () => {
      const data = clientMap.get(socket.id);
      if (data?.room_id && data.user_id) {
        // Não remove a membership: marca apenas offline para permitir reconexão.
        unbindPlayerSocket(data.room_id, data.user_id, socket.id);
        io.to(data.room_id).emit('sala:jogadores', { players: listRoomPlayers(data.room_id) });
      }
      clientMap.delete(socket.id);
    });
  });
}

// ─── Helpers ────────────────────────────────────────

function emitRoomStatus(io: Server, roomId: string) {
  const room = findRoomById(roomId);
  if (!room) return;

  const players = listRoomPlayers(roomId);
  const currentRound = findCurrentRound(roomId);
  const scores = getRoomScores(roomId);

  io.to(roomId).emit('sala:status', {
    room: {
      id: room.id,
      code: room.code,
      title: room.title,
      notes: room.notes,
      status: room.status,
    },
    players: players.map(p => ({
      user_id: p.user_id,
      name: p.name,
      role: p.role,
      score_cache: p.score_cache,
      online: p.online,
      is_duplicate: p.is_duplicate,
      player_code: p.player_code,
    })),
    scores,
    current_round: currentRound ? {
      id: currentRound.id,
      round_number: currentRound.round_number,
      status: currentRound.status,
      media_url: currentRound.media_url,
      buzzer_order: getBuzzerOrder(currentRound.id),
      answers: getRoundAnswers(currentRound.id).map(a => ({
        player_id: a.player_id,
        player_name: a.player_name,
        text: a.text,
      })),
    } : null,
  });
}

function getPresenterSocketId(io: Server, roomId: string, presenterId: string): string | null {
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return null;

  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const data = clientMap.get(socketId);
      if (data?.user_id === presenterId) return socketId;
    }
  }
  return null;
}
