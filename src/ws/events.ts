import { Server, Socket } from 'socket.io';
import {
  findRoomById, listRoomPlayers,
  createRound, closeRound, findCurrentRound, countRounds,
  registerBuzz, getBuzzerOrder,
  upsertAnswer, judgeAnswer, getRoundAnswers,
  updateScoreCache, getRoomScores,
  addPlayerToRoom, removePlayerFromRoom,
} from '../database/queries.js';

type ClientData = {
  room_id?: string;
  user_id?: string;
};

const clientMap = new Map<string, ClientData>();

export function setupSocketEvents(io: Server) {
  io.on('connection', (socket: Socket) => {
    const roomId = socket.handshake.query.room_id as string | undefined;
    const userId = socket.handshake.query.user_id as string | undefined;

    console.log(`[WS] socket ${socket.id} connected: room=${roomId}, user=${userId}`);

    clientMap.set(socket.id, { room_id: roomId, user_id: userId });

    if (roomId && userId) {
      socket.join(roomId);
      console.log(`[WS] socket ${socket.id} joined room ${roomId}, emitting sala:status`);
      emitRoomStatus(io, roomId);
    } else {
      console.log(`[WS] socket ${socket.id} missing roomId or userId`);
    }

    // ─── Sala: entrar ───────────────────────────────

    socket.on('sala:entrar', (data: { room_id: string; user_id: string }) => {
      socket.join(data.room_id);
      clientMap.set(socket.id, { room_id: data.room_id, user_id: data.user_id });
      addPlayerToRoom(data.room_id, data.user_id, 'player');
      emitRoomStatus(io, data.room_id);
      io.to(data.room_id).emit('sala:jogadores', { players: listRoomPlayers(data.room_id) });
    });

    // ─── Sala: sair ────────────────────────────────

    socket.on('sala:sair', (data: { room_id: string; user_id: string }) => {
      removePlayerFromRoom(data.room_id, data.user_id);
      socket.leave(data.room_id);
      clientMap.delete(socket.id);
      io.to(data.room_id).emit('sala:jogadores', { players: listRoomPlayers(data.room_id) });
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
        })),
      });
    });

    // ─── Resposta: escrever ────────────────────────

    socket.on('resposta:escrever', (data: { round_id: string; player_id: string; text: string }) => {
      upsertAnswer(data.round_id, data.player_id, data.text);

      const clientData = clientMap.get(socket.id);
      if (!clientData?.room_id) return;

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
      const clientData = clientMap.get(socket.id);
      const judgeId = clientData?.user_id;
      if (!judgeId) return;

      judgeAnswer(data.round_id, data.player_id, data.judgment as any, data.score_delta, judgeId);

      // Atualizar score_cache
      const answers = getRoundAnswers(data.round_id);
      const totalFromAnswers = answers
        .filter(a => a.player_id === data.player_id)
        .reduce((sum, a) => sum + a.score_delta, 0);

      // Pega score anterior + delta atual
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

    // ─── Disconnect ────────────────────────────────

    socket.on('disconnect', () => {
      const data = clientMap.get(socket.id);
      if (data?.room_id) {
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
      id: p.user_id,
      name: p.name,
      role: p.role,
      score: p.score_cache,
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
