state.currentRoundId = null;
state.myPenalty = null;
state.myAnswer = null;
state.answersRevealed = false;
state.roundGraded = false;
state.correctOption = null;
state.answersEligible = [];
state.answerResult = null;
let allScores = [];

// ─── Tipo "Respostas" ─────────────────────────────
function isAnswersGame() {
  return state.room?.type === 'answers';
}

function setupGameTypeLayout() {
  const answers = isAnswersGame();
  document.body.classList.toggle('game-answers', answers);
  const answersEl = $('player-answers');
  const buzzerEl = $('player-buzzer');
  const orderEl = $('player-buzzer-order');
  if (answersEl) answersEl.classList.toggle('hidden', !answers);
  if (buzzerEl) buzzerEl.classList.toggle('hidden', answers);
  if (orderEl) orderEl.classList.toggle('hidden', answers);
  if (answers) {
    ensureAnswersGrid();
    renderAnswers();
  }
}

function answerConfig() {
  const cfg = state.room?.config || {};
  const count = Math.min(6, Math.max(1, Number(cfg.option_count) || 4));
  const style = cfg.option_style === 'numeric' ? 'numeric' : 'alpha';
  return { count, style };
}

function answerLabel(option) {
  return answerConfig().style === 'numeric'
    ? String(option)
    : String.fromCharCode(64 + option);
}

function ensureAnswersGrid() {
  const grid = $('answers-grid');
  if (!grid) return;
  const cfg = answerConfig();
  const key = cfg.count + ':' + cfg.style;
  if (state._answersGridKey === key) return;
  state._answersGridKey = key;
  grid.innerHTML = Array.from({ length: cfg.count }, (_, i) => {
    const option = i + 1;
    return `<button type="button" class="answer-btn" data-option="${option}" disabled onclick="handleAnswer(${option})">${answerLabel(option)}</button>`;
  }).join('');
}

function answersEligibleForMe() {
  if (!state.answersEligible.length) return true;
  return state.answersEligible.includes(state.user?.id);
}

function renderAnswers() {
  if (!isAnswersGame()) return;
  ensureAnswersGrid();

  const grid = $('answers-grid');
  const status = $('answers-status');
  const resultEl = $('answer-result');
  if (!grid || !status || !resultEl) return;

  const my = state.myAnswer;
  const canAnswer = !!state.currentRoundId &&
    !state.answersRevealed &&
    !state.roundGraded &&
    answersEligibleForMe() &&
    !my;

  grid.querySelectorAll('.answer-btn').forEach(btn => {
    const option = Number(btn.dataset.option);
    btn.classList.remove('selected', 'correct', 'wrong', 'available');
    if (my === option) btn.classList.add('selected');
    if (state.answersRevealed) {
      if (state.correctOption === option) btn.classList.add('correct');
      else if (my === option) btn.classList.add('wrong');
    }
    btn.disabled = !canAnswer;
    btn.classList.toggle('available', canAnswer);
  });

  if (!state.currentRoundId) {
    status.textContent = 'Aguardando o apresentador iniciar a rodada.';
  } else if (!answersEligibleForMe()) {
    status.textContent = 'Você entrou após o início desta rodada. Aguarde a próxima.';
  } else if (state.roundGraded) {
    status.textContent = 'Rodada corrigida. Aguarde a próxima rodada.';
  } else if (my) {
    status.textContent = state.answersRevealed
      ? `Sua resposta: ${answerLabel(my)}.`
      : `Resposta registrada: ${answerLabel(my)}. Só é possível escolher uma vez.`;
  } else if (state.answersRevealed) {
    status.textContent = 'Respostas reveladas. O apresentador vai corrigir a rodada.';
  } else {
    status.textContent = 'Toque na sua resposta. Só é possível escolher uma vez.';
  }

  resultEl.classList.add('hidden');
  resultEl.className = 'answer-result hidden';
  if (state.answerResult) {
    if (state.answerResult.is_correct) {
      const pts = Number(state.answerResult.awarded) || 0;
      resultEl.textContent = `✅ Acertou! +${pts} ponto(s)`;
      resultEl.classList.add('correct');
    } else {
      const correct = state.correctOption ? ` — correta: ${answerLabel(state.correctOption)}` : '';
      resultEl.textContent = `❌ Resposta errada${correct}`;
      resultEl.classList.add('wrong');
    }
    resultEl.classList.remove('hidden');
  } else if (state.roundGraded && !my) {
    resultEl.textContent = 'Você não respondeu esta rodada.';
    resultEl.classList.add('neutral');
    resultEl.classList.remove('hidden');
  }
}

function resetAnswersRoundState() {
  state.myAnswer = null;
  state.answersRevealed = false;
  state.roundGraded = false;
  state.correctOption = null;
  state.answersEligible = [];
  state.answerResult = null;
  renderAnswers();
}

function applyAnswersRoundSnapshot(round) {
  if (round && round.status === 'active') {
    const sameRound = state.currentRoundId === round.id;
    state.currentRoundId = round.id;
    state.answersRevealed = round.answers_revealed === true;
    state.roundGraded = round.graded === true;
    state.correctOption = round.correct_option ?? null;
    state.answersEligible = Array.isArray(round.eligible_player_ids)
      ? round.eligible_player_ids
      : [];
    $('player-status-round-num').textContent = round.round_number;

    const mine = (round.answers || []).find(a => a.player_id === state.user?.id);
    if (!sameRound) {
      state.myAnswer = null;
      state.answerResult = null;
    }
    // A alternativa só vem no snapshot quando já foi revelada; a própria
    // escolha chega pelo evento personalizado resposta:minha.
    if (mine && mine.option !== null && mine.option !== undefined) {
      state.myAnswer = mine.option;
    }
    if (mine && mine.is_correct !== null && mine.is_correct !== undefined) {
      state.answerResult = { is_correct: mine.is_correct, awarded: mine.awarded_points ?? 0 };
    }
    renderAnswers();
  } else {
    state.currentRoundId = null;
    $('player-status-round-num').textContent = '1';
    resetAnswersRoundState();
  }
}

function handleAnswer(option) {
  if (!isAnswersGame()) return;
  if (!state.currentRoundId) return toast('Aguarde o apresentador iniciar a rodada');
  if (state.myAnswer) return toast('Você já respondeu esta rodada');
  if (state.answersRevealed || state.roundGraded) return toast('Esta rodada já foi encerrada');
  if (!answersEligibleForMe()) return toast('Você entrou após o início desta rodada');

  // Trava imediatamente: a escolha não pode ser revertida nem trocada.
  state.myAnswer = option;
  renderAnswers();

  if (navigator.vibrate) navigator.vibrate(40);

  state.socket.emit('resposta:enviar', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    player_id: state.user.id,
    option,
  }, (res) => {
    if (res && res.ok) return;
    // Recusa do servidor: se foi duplicada, a escolha antiga continua valendo.
    if (res && res.code === 'DUPLICATE') {
      toast(res.error || 'Você já respondeu esta rodada');
      return;
    }
    state.myAnswer = null;
    renderAnswers();
    toast((res && res.error) || 'Não foi possível registrar sua resposta');
  });
}


function setBuzzerState(mode) {
  const buzzer = $('player-buzzer');
  buzzer.disabled = mode !== 'active';
  const wasFirst = buzzer.classList.contains('first-buzz');
  buzzer.className = 'buzzer-btn buzzer-' + mode;
  if (wasFirst) buzzer.classList.add('first-buzz');
}

function updateBuzzerBadge(position) {
  const badge = $('buzzer-pos');
  if (!badge) return;
  if (position) {
    badge.textContent = position + 'º';
    badge.classList.add('show');
  } else {
    badge.textContent = '';
    badge.classList.remove('show');
  }
}

function setPenaltyBanner(penalty) {
  state.myPenalty = penalty || null;
  const banner = $('player-penalty');
  const text = $('player-penalty-text');
  if (!banner || !text) return;

  if (!penalty) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  text.textContent = penalty.active
    ? `Sem buzinar por ${penalty.rounds_remaining} rodada(s)`
    : `Punição: ${penalty.rounds_remaining} rodadas sem buzinar a partir da próxima rodada`;
}

function renderBuzzerOrder(order) {
  const orderEl = $('player-buzzer-order');
  if (!order || order.length === 0) { orderEl.innerHTML = ''; return; }
  const html = order.map(o =>
    `<span class="pos"><span class="num">${o.position}º</span> ${escapeHtml(o.player_name)}</span>`
  ).join('');
  orderEl.innerHTML = `<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;">${html}</div>`;
}

function applyRoundSnapshot(round) {
  if (isAnswersGame()) {
    applyAnswersRoundSnapshot(round);
    return;
  }

  const buzzer = $('player-buzzer');
  if (round && round.status === 'active') {
    state.currentRoundId = round.id;
    $('player-status-round-num').textContent = round.round_number;
    const order = round.buzzer_order || [];
    const myBuzz = order.find(o => o.player_id === state.user.id);
    if (state.myPenalty?.active) {
      setBuzzerState('punished');
    } else {
      setBuzzerState(myBuzz ? 'pressed' : 'active');
    }
    updateBuzzerBadge(myBuzz?.position);
    buzzer.classList.toggle('first-buzz', order[0]?.player_id === state.user.id);
    renderBuzzerOrder(order);
  } else {
    state.currentRoundId = null;
    $('player-status-round-num').textContent = '1';
    setBuzzerState('disabled');
    updateBuzzerBadge(null);
    buzzer.classList.remove('first-buzz');
    renderBuzzerOrder([]);
  }
}

function handleBuzz(event) {
  if (!state.currentRoundId) return toast('Nenhuma rodada ativa');
  if (state.myPenalty?.active) {
    return toast(`Você está punido: ${state.myPenalty.rounds_remaining} rodada(s) sem buzinar`);
  }
  const buzzer = $('player-buzzer');
  if (buzzer.disabled) return;
  if (navigator.vibrate) navigator.vibrate(50);
  triggerRipple(buzzer, event);
  state.socket.emit('buzina:apertar', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    player_id: state.user.id,
  });
}

function updatePlayerRank(scores) {
  if (!scores || !scores.length || !state.user) return;
  
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const myScoreEntry = scores.find(s => s.player_id === state.user.id);
  if (!myScoreEntry) return;

  const myScore = myScoreEntry.score;
  
  // Rank baseado em quantos jogadores têm score estritamente maior (Standard Competition Ranking)
  const myRank = sorted.filter(s => s.score > myScore).length + 1;
  
  // Encontrar max e min para lógica de destaque
  const allScores = scores.map(s => s.score);
  const maxScore = Math.max(...allScores);
  const minScore = Math.min(...allScores);

  const rankEl = $('player-rank');
  const cardEl = $('player-score-card');
  
  rankEl.textContent = myRank + 'º';
  
  // Reset de classes
  cardEl.classList.remove('is-first', 'is-last');

  // Só aplica destaque se houver diferença de pontos na sala
  if (maxScore !== minScore) {
    if (myScore === maxScore) {
      cardEl.classList.add('is-first');
    } else if (myScore === minScore) {
      cardEl.classList.add('is-last');
    }
  }
}

function connectPlayerSocket() {
  state.socket = io('/', { query: { room_id: state.room.id, user_id: state.user.id } });

  state.socket.on('connect', () => {
    state.socket.emit('sala:entrar', { room_id: state.room.id, user_id: state.user.id });
  });

  state.socket.on('connect_error', (err) => toast('Erro de conexão: ' + err.message));

  // Sessão nova adotou o jogador antigo (mesmo nome, entrada offline).
  state.socket.on('sessao:adotada', (data) => {
    if (!data?.user) return;
    state.user = data.user;
    $('player-name').textContent = state.user.name;
    toast('Sessão recuperada. Seus pontos foram mantidos.');
  });

  // Apresentador removeu este jogador da sala.
  state.socket.on('sala:removido', (data) => {
    toast((data && data.message) || 'Você foi removido da sala');
    try { state.socket.disconnect(); } catch (_) { /* ignore */ }
    localStorage.removeItem('last_room_code');
    setTimeout(() => location.href = '/', 1500);
  });

  state.socket.on('sala:status', (data) => {
    state.room = { ...state.room, ...data.room };
    $('player-room-title').textContent = state.room.title || 'Quiz';
    $('player-status-room-title').textContent = state.room.title || 'Quiz';
    const mePlayer = data.players?.find(p => p.user_id === state.user.id);
    const me = data.scores?.find(s => s.player_id === state.user.id);
    setPenaltyBanner(mePlayer?.penalty ?? me?.penalty ?? null);
    if (me) $('player-score').textContent = me.score;
    allScores = data.scores || [];
    updatePlayerRank(allScores);
    setupGameTypeLayout();
    applyRoundSnapshot(data.current_round);
  });

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    $('player-status-round-num').textContent = data.round_number;

    if (isAnswersGame()) {
      state.myAnswer = null;
      state.answersRevealed = false;
      state.roundGraded = false;
      state.correctOption = null;
      state.answerResult = null;
      state.answersEligible = Array.isArray(data.eligible_player_ids)
        ? data.eligible_player_ids
        : [];
      setupGameTypeLayout();
      renderAnswers();
      showRoundGo();
      if (navigator.vibrate) navigator.vibrate(60);
      return;
    }

    const myPunishment = (data.punishments || []).find(p => p.player_id === state.user.id);
    if (myPunishment) {
      setPenaltyBanner({
        active: true,
        starts_next_round: false,
        rounds_remaining: myPunishment.rounds_remaining,
      });
      setBuzzerState('punished');
      toast(`Você está punido: ${myPunishment.rounds_remaining} rodada(s) sem buzinar`);
    } else {
      setPenaltyBanner(null);
      setBuzzerState('active');
    }

    updateBuzzerBadge(null);
    renderBuzzerOrder([]);
    showRoundGo();
    if (navigator.vibrate) navigator.vibrate(60);

    const buzzer = $('player-buzzer');
    if (!myPunishment) {
      buzzer.classList.add('buzzer-activated');
      buzzer.addEventListener('animationend', function onEnd() {
        buzzer.classList.remove('buzzer-activated');
        buzzer.removeEventListener('animationend', onEnd);
      });
    }
  });

  state.socket.on('buzina:ordem', (data) => {
    if (isAnswersGame()) return;
    const myInfo = data.order.find(o => o.player_id === state.user.id);
    const wasAlreadyPressed = $('player-buzzer').classList.contains('buzzer-pressed');
    
    if (myInfo) {
      setBuzzerState('pressed');
      updateBuzzerBadge(myInfo.position);
      
      // Se acabou de apertar (não estava 'pressed' antes), mostra o toast
      if (!wasAlreadyPressed) {
        const prefix = myInfo.position === 1 ? '🏆 ' : '';
        toast(`${prefix}VOCÊ É O ${myInfo.position}º!`);
      }
    }
    
    $('player-buzzer').classList.toggle('first-buzz', data.order[0]?.player_id === state.user.id);
    renderBuzzerOrder(data.order);
  });

  // ─── Tipo Respostas ─────────────────────────────
  state.socket.on('respostas:ordem', (data) => {
    if (!isAnswersGame() || !data) return;
    state.answersRevealed = data.answers_revealed === true;
    if (Array.isArray(data.eligible_player_ids)) {
      state.answersEligible = data.eligible_player_ids;
    }
    renderAnswers();
  });

  state.socket.on('respostas:reveladas', (data) => {
    if (!isAnswersGame() || !data) return;
    const wasRevealed = state.answersRevealed;
    state.answersRevealed = true;
    state.roundGraded = data.graded === true;
    state.correctOption = data.correct_option ?? null;
    if (Array.isArray(data.eligible_player_ids)) {
      state.answersEligible = data.eligible_player_ids;
    }
    renderAnswers();
    if (!wasRevealed) toast('As respostas foram reveladas!');
  });

  // Alternativa do próprio jogador (enviada só para os sockets dele).
  state.socket.on('resposta:minha', (data) => {
    if (!isAnswersGame() || !data) return;
    if (data.round_id !== state.currentRoundId) return;
    if (data.option !== null && data.option !== undefined) {
      state.myAnswer = data.option;
    }
    renderAnswers();
  });

  state.socket.on('respostas:corrigidas', (data) => {
    if (!isAnswersGame() || !data) return;
    state.answersRevealed = true;
    state.roundGraded = true;
    state.correctOption = data.correct_option ?? null;
    if (Array.isArray(data.eligible_player_ids)) {
      state.answersEligible = data.eligible_player_ids;
    }
    const mine = (data.answers || []).find(a => a.player_id === state.user.id);
    if (mine) {
      if (mine.option !== null && mine.option !== undefined) state.myAnswer = mine.option;
      state.answerResult = {
        is_correct: mine.is_correct === true,
        awarded: mine.awarded_points ?? 0,
      };
    }
    renderAnswers();

    if (state.answerResult) {
      if (state.answerResult.is_correct) {
        toast(`✅ Você acertou! +${state.answerResult.awarded} ponto(s)`);
        if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
      } else {
        toast('❌ Você errou esta rodada');
        if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
      }
    }
  });

  state.socket.on('placar:atualizado', (data) => {
    const me = data.scores.find(s => s.player_id === state.user.id);
    if (me) {
      $('player-score').textContent = me.score;
      setPenaltyBanner(me.penalty ?? null);
    }
    allScores = data.scores;
    updatePlayerRank(data.scores);
  });

  state.socket.on('jogador:punido', (data) => {
    if (!data) return;

    // Punição por pontos: o placar é atualizado por placar:atualizado.
    if (data.penalty_type === 'points') {
      if (data.player_id === state.user.id) {
        toast(`Você errou! −${data.points_subtracted} ponto(s).`);
        if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
      } else {
        toast(`${data.player_name} errou: −${data.points_subtracted} ponto(s)`);
      }
      return;
    }

    if (data.player_id === state.user.id) {
      setPenaltyBanner({
        active: false,
        starts_next_round: true,
        rounds_remaining: data.duration_rounds,
      });
      toast(`Você errou! ${data.duration_rounds} rodadas sem buzinar.`);
      if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
    } else {
      toast(`${data.player_name} foi punido: ${data.duration_rounds} rodadas sem buzinar`);
    }
  });

  state.socket.on('rodada:proxima', () => {
    state.currentRoundId = null;
    resetAnswersRoundState();
    setBuzzerState('disabled');
    updateBuzzerBadge(null);
    $('player-buzzer').classList.remove('first-buzz');
    renderBuzzerOrder([]);
  });

  state.socket.on('erro', (data) => {
    toast(data.message);
    if (data && (data.code === 'KICKED' || data.code === 'NAME_TAKEN')) {
      localStorage.removeItem('last_room_code');
      setTimeout(() => location.href = '/', 1500);
    }
  });
}

// ─── Placar Overlay ──────────────────────────────
function renderPlacarOverlay() {
  const list = $('placar-list');
  if (!list) return;
  if (!allScores.length) {
    list.innerHTML = '<div class="placar-empty-msg">Nenhum jogador na sala</div>';
    return;
  }
  const sorted = [...allScores].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(sorted[0]?.score || 1, 1);
  let html = '';
  let i = 0;
  for (const s of sorted) {
    if (i >= 10) break; i++;
    const pos = sorted.filter(x => x.score > s.score).length + 1;
    const posText = ['🥇', '🥈', '🥉'][pos - 1] || pos + 'º';
    const pct = Math.max((s.score / maxScore) * 100, 3);
    const isMe = s.player_id === state.user.id;
    const escName = escapeHtml(s.player_name || 'Jogador');
    const penaltyBadge = s.penalty
      ? '<span class="placar-penalty" title="Punido: ' + s.penalty.rounds_remaining + ' rodada(s) sem buzinar">🚫 ' + s.penalty.rounds_remaining + '</span>'
      : '';
    html += '<div class="placar-row' + (isMe ? ' is-me' : '') + '" data-pos="' + pos + '">'
      + '<div class="placar-pos">' + posText + '</div>'
      + '<div class="placar-name"><span class="placar-name-text">' + escName + '</span>' + penaltyBadge + '</div>'
      + '<div class="placar-score">' + s.score + '</div>'
      + '</div>'
      + '<div class="placar-bar-row' + (isMe ? ' is-me' : '') + '">'
      + '<div class="placar-bar"><div class="placar-bar-fill" style="width:' + pct + '%"></div></div>'
      + '</div>';
  }
  list.innerHTML = html;
}

function showPlacar() {
  renderPlacarOverlay();
  $('placar-overlay').classList.remove('hidden');
}

function hidePlacar() {
  $('placar-overlay').classList.add('hidden');
}

// ─── Init ─────────────────────────────────────────
setupAuth()
  .then(() => requireRoom(getRoomCodeFromUrl()))
  .then(room => {
    if (room.presenter_id === state.user.id) {
      location.href = '/apresentador?sala=' + room.code;
      return;
    }
    $('player-name').textContent = state.user.name;
    const roomTitle = room.title || 'Quiz';
    $('player-room-title').textContent = roomTitle;
    $('player-status-room-title').textContent = roomTitle;
    document.title = roomTitle + ' — Jogador';
    setupGameTypeLayout();
    return api('/rooms/' + room.id + '/players', { user_id: state.user.id })
      .then(res => {
        if (!res || !res.ok) {
          toast((res && res.error) || 'Não foi possível entrar na sala');
          localStorage.removeItem('last_room_code');
          setTimeout(() => location.href = '/', 1500);
          return;
        }
        if (res.user && res.user.id !== state.user.id) {
          state.user = res.user;
          $('player-name').textContent = state.user.name;
          toast('Bem-vindo de volta! Seus pontos foram mantidos.');
        }
        connectPlayerSocket();
      });
  })
  .catch(() => { /* redirect já feito */ });

// ─── Eventos do Placar Overlay (touch + mouse) ──
let _touchPlacar = false;

const placarBtn = $('btn-ver-placar');
if (placarBtn) {
  placarBtn.addEventListener('touchstart', function (e) {
    _touchPlacar = true;
    showPlacar();
  }, { passive: true });

  placarBtn.addEventListener('mousedown', function (e) {
    if (_touchPlacar) return;
    showPlacar();
  });
}

document.addEventListener('touchend', function () {
  _touchPlacar = false;
  hidePlacar();
}, { passive: true });

document.addEventListener('touchcancel', function () {
  _touchPlacar = false;
  hidePlacar();
}, { passive: true });

document.addEventListener('mouseup', function () {
  if (_touchPlacar) return;
  hidePlacar();
});
