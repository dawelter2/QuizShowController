import { Server, Socket } from 'socket.io';
import {
  findRoomById, listRoomPlayers,
  createRound, closeRound, findCurrentRound, findRoundById, countRounds,
  registerBuzz, getBuzzerOrder,
  updateScoreCache, getRoomScores, resetRoomGame,
  getPlayerPenalty, punishPlayer, isRoundLimitReached,
  joinRoomAsPlayer, removePlayerFromRoom, kickPlayerFromRoom,
  bindPlayerSocket, unbindPlayerSocket, listPlayerSocketIds, listRoomSocketEntries,
  isActiveRoomMember, renameUser, isNameTakenInRoom, sanitizePlayerName,
  setRoundEligiblePlayers, registerAnswer, maybeRevealAnswers,
  revealRoundAnswers, gradeRoundAnswers, getAnswerOrder, listRoundAnswers,
} from '../store/queries.js';
import type { Round } from '../store/queries.js';
import { answersConfigFor } from '../store/game-types.js';

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
      // Se o jogador que saiu era o último pendente, as respostas são reveladas.
      revealAnswersIfComplete(io, roomToLeave);
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
      revealAnswersIfComplete(io, data.room_id);
      emitRoomStatus(io, data.room_id);
      ack?.({ ok: true });
    });

    // ─── Rodada: iniciar ───────────────────────────

    socket.on('rodada:iniciar', (data: { room_id: string; media_url?: string; correct_answer?: string }) => {
      const room = findRoomById(data.room_id);
      if (!room) return;

      // Limite de rodadas configurado na criação da sala (0 = sem limite).
      if (isRoundLimitReached(data.room_id)) {
        const limit = room.config.total_rounds ?? 0;
        socket.emit('erro', {
          code: 'LIMITE_RODADAS',
          message: `Limite de ${limit} rodada(s) atingido. Reinicie a partida para jogar novamente.`,
        });
        return;
      }

      const roundNumber = countRounds(data.room_id) + 1;
      const round = createRound(
        data.room_id,
        roundNumber,
        data.media_url || '',
        data.correct_answer || '',
      );

      // No tipo "Respostas", a rodada começa com um snapshot dos jogadores
      // elegíveis. Quem entrar depois aguarda a próxima rodada.
      if (room.type === 'answers') {
        const eligible = listRoomPlayers(data.room_id)
          .filter(p => p.role === 'player')
          .map(p => p.user_id);
        setRoundEligiblePlayers(round.id, eligible);
      }

      // Jogadores punidos entram na rodada com a buzina bloqueada; o contador
      // diminui a cada nova rodada.
      const punishments = listRoomPlayers(data.room_id)
        .filter(p => p.penalty?.active === true)
        .map(p => ({ player_id: p.user_id, rounds_remaining: p.penalty?.rounds_remaining ?? 0 }));

      io.to(data.room_id).emit('rodada:iniciada', {
        round_id: round.id,
        round_number: round.round_number,
        media_url: round.media_url,
        punishments,
        game_type: room.type,
        eligible_player_ids: round.eligible_player_ids,
      });

      // Status completo: atualiza badges de punição e contadores em todas as telas.
      emitRoomStatus(io, data.room_id);
    });

    // ─── Buzina: apertar ───────────────────────────

    socket.on('buzina:apertar', (data: { room_id: string; round_id: string; player_id: string }) => {
      const clientData = clientMap.get(socket.id);
      if (!clientData?.room_id || clientData.user_id !== data.player_id ||
          !isActiveRoomMember(clientData.room_id, data.player_id)) {
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message: 'Jogador não está ativo na sala' });
        return;
      }

      const round = findRoundById(data.round_id);
      if (!round || round.room_id !== clientData.room_id) {
        socket.emit('erro', { code: 'RODADA_INVALIDA', message: 'Rodada não encontrada' });
        return;
      }

      const room = findRoomById(round.room_id);
      if (!room || room.type !== 'buzzer-order') {
        socket.emit('erro', { code: 'TIPO_INVALIDO', message: 'Esta sala não usa buzina' });
        return;
      }

      // Punição por erro: não pode buzinar nas rodadas seguintes ao erro.
      const penalty = getPlayerPenalty(clientData.room_id, data.player_id, round.round_number);
      if (penalty?.active) {
        socket.emit('erro', {
          code: 'PUNIDO',
          message: `Você está punido: ${penalty.rounds_remaining} rodada(s) sem buzinar`,
        });
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

    // ─── Respostas: jogador escolhe alternativa ────

    socket.on('resposta:enviar', (
      data: { room_id: string; round_id: string; player_id: string; option: number },
      ack?: Ack,
    ) => {
      const clientData = clientMap.get(socket.id);
      if (!clientData?.room_id || clientData.user_id !== data.player_id ||
          !isActiveRoomMember(clientData.room_id, data.player_id)) {
        const message = 'Jogador não está ativo na sala';
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const room = findRoomById(clientData.room_id);
      if (!room || room.type !== 'answers') {
        const message = 'Esta sala não usa o tipo Respostas';
        socket.emit('erro', { code: 'TIPO_INVALIDO', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const round = findRoundById(data.round_id);
      if (!round || round.room_id !== room.id) {
        const message = 'Rodada não encontrada';
        socket.emit('erro', { code: 'RODADA_INVALIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const cfg = answersConfigFor(room.config);
      const option = Number(data.option);
      if (!Number.isInteger(option) || option < 1 || option > cfg.option_count) {
        const message = 'Alternativa inválida';
        socket.emit('erro', { code: 'OPCAO_INVALIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const result = registerAnswer(round.id, data.player_id, option);
      if (!result.ok) {
        socket.emit('erro', { code: result.code, message: result.message });
        ack?.({ ok: false, code: result.code, error: result.message });
        return;
      }

      // O componente de ordem das respostas recebe as alternativas ocultas
      // (option = null) até a revelação.
      io.to(room.id).emit('respostas:ordem', answersPayload(round));

      // Cada jogador recebe apenas a própria escolha (para reconexão e abas
      // múltiplas), sem expor a dos demais antes da revelação.
      for (const socketId of listPlayerSocketIds(room.id, data.player_id)) {
        io.to(socketId).emit('resposta:minha', {
          room_id: room.id,
          round_id: round.id,
          option: result.event.option,
          position: result.event.position,
        });
      }

      if (maybeRevealAnswers(room.id, round.id)) {
        io.to(room.id).emit('respostas:reveladas', answersPayload(round));
        emitRoomStatus(io, room.id);
      }

      ack?.({ ok: true, position: result.event.position, option: result.event.option });
    });

    // ─── Respostas: revelar (apresentador) ─────────

    socket.on('respostas:revelar', (
      data: { room_id: string; round_id?: string },
      ack?: Ack,
    ) => {
      const room = findRoomById(data.room_id);
      const presenterId = clientMap.get(socket.id)?.user_id;
      if (!room || !presenterId || presenterId !== room.presenter_id) {
        const message = 'Apenas o apresentador pode revelar as respostas';
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message });
        ack?.({ ok: false, error: message });
        return;
      }
      if (room.type !== 'answers') {
        const message = 'Esta sala não usa o tipo Respostas';
        socket.emit('erro', { code: 'TIPO_INVALIDO', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const round = data.round_id
        ? findRoundById(data.round_id)
        : findCurrentRound(room.id);
      if (!round || round.room_id !== room.id) {
        const message = 'Rodada não encontrada';
        socket.emit('erro', { code: 'RODADA_INVALIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }
      if (round.status !== 'active') {
        const message = 'A rodada já foi encerrada';
        socket.emit('erro', { code: 'RODADA_ENCERRADA', message });
        ack?.({ ok: false, error: message });
        return;
      }
      if (round.answers_graded) {
        const message = 'Esta rodada já foi corrigida';
        socket.emit('erro', { code: 'JA_CORRIGIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const revealedNow = revealRoundAnswers(round.id);
      const payload = answersPayload(round);
      io.to(room.id).emit('respostas:reveladas', payload);
      emitRoomStatus(io, room.id);
      ack?.({ ok: true, revealed: true, changed: revealedNow });
    });

    // ─── Respostas: corrigir (apresentador) ────────

    socket.on('resposta:corrigir', (
      data: { room_id: string; round_id?: string; option: number },
      ack?: Ack,
    ) => {
      const room = findRoomById(data.room_id);
      const presenterId = clientMap.get(socket.id)?.user_id;
      if (!room || !presenterId || presenterId !== room.presenter_id) {
        const message = 'Apenas o apresentador pode corrigir a rodada';
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message });
        ack?.({ ok: false, error: message });
        return;
      }
      if (room.type !== 'answers') {
        const message = 'Esta sala não usa o tipo Respostas';
        socket.emit('erro', { code: 'TIPO_INVALIDO', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const round = data.round_id
        ? findRoundById(data.round_id)
        : findCurrentRound(room.id);
      if (!round || round.room_id !== room.id) {
        const message = 'Rodada não encontrada';
        socket.emit('erro', { code: 'RODADA_INVALIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const cfg = answersConfigFor(room.config);
      const option = Number(data.option);
      if (!Number.isInteger(option) || option < 1 || option > cfg.option_count) {
        const message = 'Alternativa correta inválida';
        socket.emit('erro', { code: 'OPCAO_INVALIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const result = gradeRoundAnswers(
        round.id,
        option,
        cfg.points_first,
        cfg.points_later,
      );
      if (!result.ok) {
        socket.emit('erro', { code: result.code, message: result.message });
        ack?.({ ok: false, code: result.code, error: result.message });
        return;
      }

      const scores = getRoomScores(room.id);
      io.to(room.id).emit('respostas:corrigidas', {
        ...answersPayload(round),
        correct_option: result.correct_option,
        scores,
      });
      io.to(room.id).emit('placar:atualizado', { room_id: room.id, scores });
      emitRoomStatus(io, room.id);
      ack?.({ ok: true, correct_option: result.correct_option, scores });
    });

    // ─── Pontos: alterar ───────────────────────────

    socket.on('pontos:alterar', (data: { room_id: string; round_id: string; player_id: string; score_delta?: number; judgment?: 'exact' | 'near' }) => {
      const room = findRoomById(data.room_id);
      const presenterId = clientMap.get(socket.id)?.user_id;
      if (!room || !presenterId || presenterId !== room.presenter_id) {
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message: 'Apenas o apresentador pode alterar pontos' });
        return;
      }
      if (room.type !== 'buzzer-order') {
        socket.emit('erro', { code: 'TIPO_INVALIDO', message: 'Use a correção de respostas nesta sala' });
        return;
      }

      // Preferir o julgamento ("certeira"/"quase"): o valor vem da configuração
      // da sala, não do cliente. score_delta continua aceito por compatibilidade.
      let delta = data.score_delta;
      if (data.judgment === 'exact') delta = room.config.points_exact ?? 0;
      if (data.judgment === 'near') delta = room.config.points_near ?? 0;

      if (typeof delta !== 'number' || !Number.isFinite(delta)) {
        socket.emit('erro', { code: 'PONTOS_INVALIDOS', message: 'Pontuação inválida' });
        return;
      }

      // Atualizar score_cache
      const players = listRoomPlayers(data.room_id);
      const player = players.find(p => p.user_id === data.player_id);
      const newScore = (player?.score_cache || 0) + delta;
      updateScoreCache(data.room_id, data.player_id, newScore);

      const scores = getRoomScores(data.room_id);
      io.to(data.room_id).emit('placar:atualizado', { room_id: data.room_id, scores });
    });

    // ─── Jogador: punir (erro) ─────────────────────

    socket.on('jogador:punir', (data: { room_id: string; player_id: string; round_id?: string }, ack?: Ack) => {
      const room = findRoomById(data.room_id);
      const presenterId = clientMap.get(socket.id)?.user_id;
      if (!room || !presenterId || presenterId !== room.presenter_id) {
        const message = 'Apenas o apresentador pode aplicar punições';
        socket.emit('erro', { code: 'NAO_AUTORIZADO', message });
        ack?.({ ok: false, error: message });
        return;
      }
      if (room.type !== 'buzzer-order') {
        const message = 'Punições não se aplicam ao tipo Respostas';
        socket.emit('erro', { code: 'TIPO_INVALIDO', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const currentRound = findCurrentRound(data.room_id);
      if (!currentRound || currentRound.status !== 'active') {
        const message = 'Inicie uma rodada primeiro';
        socket.emit('erro', { code: 'SEM_RODADA_ATIVA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      if (data.round_id && data.round_id !== currentRound.id) {
        const message = 'Rodada inválida';
        socket.emit('erro', { code: 'RODADA_INVALIDA', message });
        ack?.({ ok: false, error: message });
        return;
      }

      // O botão "Errou" só existe para quem apertou a buzina nesta rodada.
      const hasBuzzed = getBuzzerOrder(currentRound.id).some(e => e.player_id === data.player_id);
      if (!hasBuzzed) {
        const message = 'Este jogador não apertou a buzina nesta rodada';
        socket.emit('erro', { code: 'JOGADOR_NAO_BUZINOU', message });
        ack?.({ ok: false, error: message });
        return;
      }

      const result = punishPlayer(data.room_id, data.player_id);
      if (!result.ok) {
        socket.emit('erro', { code: result.code, message: result.message });
        ack?.({ ok: false, error: result.message });
        return;
      }

      const player = listRoomPlayers(data.room_id).find(p => p.user_id === data.player_id);

      // Punição por pontos: desconta do placar e não bloqueia a buzina.
      if (result.penalty_type === 'points') {
        io.to(data.room_id).emit('jogador:punido', {
          player_id: data.player_id,
          player_name: player?.name ?? 'Jogador',
          penalty_type: 'points',
          points_subtracted: result.points_subtracted,
          new_score: result.new_score,
        });
        io.to(data.room_id).emit('placar:atualizado', {
          room_id: data.room_id,
          scores: getRoomScores(data.room_id),
        });
        emitRoomStatus(io, data.room_id);
        ack?.({
          ok: true,
          penalty_type: 'points',
          points_subtracted: result.points_subtracted,
          new_score: result.new_score,
        });
        return;
      }

      io.to(data.room_id).emit('jogador:punido', {
        player_id: data.player_id,
        player_name: player?.name ?? 'Jogador',
        penalty_type: 'rounds',
        duration_rounds: result.penalty.rounds_remaining,
        start_round: result.penalty.start_round,
        rounds_remaining: result.penalty.rounds_remaining,
      });
      emitRoomStatus(io, data.room_id);
      ack?.({ ok: true, penalty_type: 'rounds', penalty: result.penalty });
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

// Payload do componente de ordem das respostas. As alternativas continuam
// ocultas (option = null) até a rodada ser revelada.
function answersPayload(round: Round) {
  const answers = getAnswerOrder(round.id);
  return {
    room_id: round.room_id,
    round_id: round.id,
    round_number: round.round_number,
    answers,
    answered_count: answers.length,
    eligible_player_ids: round.eligible_player_ids,
    eligible_count: round.eligible_player_ids.length,
    answers_revealed: round.answers_revealed,
    graded: round.answers_graded,
    correct_option: round.correct_option,
  };
}

function revealAnswersIfComplete(io: Server, roomId: string) {
  const room = findRoomById(roomId);
  if (!room || room.type !== 'answers') return;

  const round = findCurrentRound(roomId);
  if (!round) return;

  if (maybeRevealAnswers(roomId, round.id)) {
    io.to(roomId).emit('respostas:reveladas', answersPayload(round));
    emitRoomStatus(io, roomId);
  }
}

function emitRoomStatus(io: Server, roomId: string) {
  const room = findRoomById(roomId);
  if (!room) return;

  const players = listRoomPlayers(roomId);
  const currentRound = findCurrentRound(roomId);
  const scores = getRoomScores(roomId);

  const payload = {
    room: {
      id: room.id,
      code: room.code,
      title: room.title,
      notes: room.notes,
      status: room.status,
      type: room.type,
      config: room.config,
    },
    rounds_played: countRounds(roomId),
    players: players.map(p => ({
      user_id: p.user_id,
      name: p.name,
      role: p.role,
      score_cache: p.score_cache,
      online: p.online,
      is_duplicate: p.is_duplicate,
      player_code: p.player_code,
      penalty: p.penalty,
    })),
    scores,
    current_round: currentRound ? {
      id: currentRound.id,
      round_number: currentRound.round_number,
      status: currentRound.status,
      media_url: currentRound.media_url,
      game_type: room.type,
      buzzer_order: room.type === 'buzzer-order' ? getBuzzerOrder(currentRound.id) : [],
      answers_revealed: currentRound.answers_revealed,
      graded: currentRound.answers_graded,
      correct_option: currentRound.correct_option,
      eligible_player_ids: currentRound.eligible_player_ids,
      answers: room.type === 'answers' ? getAnswerOrder(currentRound.id) : [],
      answered_count: room.type === 'answers' ? listRoundAnswers(currentRound.id).length : 0,
    } : null,
  };

  io.to(roomId).emit('sala:status', payload);

  // No tipo "Respostas", envia a cada jogador a própria alternativa (as
  // demais continuam ocultas até a revelação).
  if (room.type === 'answers' && currentRound) {
    const answers = listRoundAnswers(currentRound.id);
    for (const entry of listRoomSocketEntries(roomId)) {
      const own = answers.find(a => a.player_id === entry.user_id);
      io.to(entry.socket_id).emit('resposta:minha', {
        room_id: roomId,
        round_id: currentRound.id,
        option: own?.option ?? null,
        position: own?.position ?? null,
      });
    }
  }
}
