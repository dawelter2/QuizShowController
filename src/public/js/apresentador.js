// Estado específico do apresentador
state.currentRoundId = null;
state.currentRoundNumber = null;
state.roundsPlayed = 0;
state.buzzerOrder = [];
state.autoNextRound = false;
state.advancingRound = false;
state.showVideo = false;
state.videoUrl = '';
state.videoId = '';
state.quizUrl = '';
state.judgedPlayers = new Set();
state.prevScoresByPid = {};
// Tipo "Respostas"
state.answerOrder = [];
state.answersRevealed = false;
state.answersGraded = false;
state.correctOption = null;
state.pendingCorrectOption = null;
state.answersEligible = [];
state.gradingAnswers = false;
state.revealingAnswers = false;

// Configuração da sala (valores default = comportamento antigo do jogo).
const PRESENTER_DEFAULT_CONFIG = {
  quiz_url: '',
  total_rounds: 0,
  points_exact: 3,
  points_near: 1,
  penalty_type: 'rounds',
  penalty_rounds: 3,
  penalty_points: 3,
};

function roomConfig() {
  return { ...PRESENTER_DEFAULT_CONFIG, ...(state.room?.config || {}) };
}

function roundsLimitReached() {
  const total = Number(roomConfig().total_rounds) || 0;
  return total > 0 && (state.roundsPlayed || 0) >= total;
}

function updateRoundDisplay(roundNumber) {
  const total = Number(roomConfig().total_rounds) || 0;
  const numEl = $('pres-round-num');
  const totalEl = $('pres-round-total');
  if (numEl && roundNumber != null) numEl.textContent = roundNumber;
  if (totalEl) totalEl.textContent = total > 0 ? ` de ${total}` : '';
}

// ─── Tipo "Respostas" ───────────────────────────────
function isAnswersGame() {
  return state.room?.type === 'answers';
}

function answerConfig() {
  const cfg = state.room?.config || {};
  const count = Math.min(6, Math.max(1, Number(cfg.option_count) || 4));
  const style = cfg.option_style === 'numeric' ? 'numeric' : 'alpha';
  return {
    count,
    style,
    points_first: Number(cfg.points_first) || 0,
    points_later: Number(cfg.points_later) || 0,
    video_url: typeof cfg.video_url === 'string' ? cfg.video_url : '',
  };
}

function answerLabel(option) {
  return answerConfig().style === 'numeric'
    ? String(option)
    : String.fromCharCode(64 + option);
}

function setupGameTypeLayout() {
  const answers = isAnswersGame();
  const buzzerPanel = $('panel-buzzer-order');
  const answerPanel = $('panel-answers');
  const correctPanel = $('panel-correct-answer');
  if (buzzerPanel) buzzerPanel.classList.toggle('hidden', answers);
  if (answerPanel) answerPanel.classList.toggle('hidden', !answers);
  if (correctPanel) {
    correctPanel.classList.toggle('hidden', !answers || !state.answersRevealed);
  }
  if (answers) {
    renderAnswerOrder();
    renderCorrectAnswerPanel();
  }
}

function answeredPlayerIds() {
  return new Set((state.answerOrder || []).map(a => a.player_id));
}

function eligiblePlayers() {
  const active = (state.players || []).filter(p => p.role === 'player');
  if (!state.answersEligible.length) return active;
  const ids = new Set(state.answersEligible);
  return active.filter(p => ids.has(p.user_id));
}

function renderAnswerOrder() {
  const container = $('pres-answer-order');
  if (!container) return;

  const order = (state.answerOrder || []).slice().sort((a, b) => a.position - b.position);
  const eligible = eligiblePlayers();
  const answered = answeredPlayerIds();
  const progress = $('pres-answers-progress');
  if (progress) {
    if (!state.currentRoundId) progress.textContent = 'aguardando rodada';
    else if (state.answersRevealed) progress.textContent = `${order.length} resposta(s) · reveladas`;
    else progress.textContent = `${order.length}/${eligible.length} responderam`;
  }

  // Botão de revelação manual (para jogador AFK).
  const footer = $('answers-footer');
  const revealBtn = $('btn-reveal-answers');
  const canReveal = !!state.currentRoundId &&
    !state.answersRevealed &&
    !state.answersGraded;
  if (footer) footer.classList.toggle('hidden', !canReveal);
  if (revealBtn) {
    revealBtn.disabled = state.revealingAnswers || order.length === 0;
    revealBtn.textContent = order.length === 0
      ? '👁 Revelar respostas (sem respostas ainda)'
      : '👁 Revelar respostas agora';
  }

  if (order.length === 0) {
    let message = 'Aguardando o início da rodada.';
    if (state.currentRoundId && state.answersRevealed) message = 'Nenhuma resposta nesta rodada.';
    else if (state.currentRoundId) message = 'Ninguém respondeu ainda.';
    container.innerHTML = `<p class="panel-empty">${message}</p>`;
    return;
  }

  const firstTs = order[0]?.timestamp ? new Date(order[0].timestamp).getTime() : null;
  const missing = eligible.filter(p => !answered.has(p.user_id));

  let html = order.map((a, i) => {
    let deltaHtml = '';
    if (firstTs && a.timestamp) {
      const diff = (new Date(a.timestamp).getTime() - firstTs) / 1000;
      if (diff > 0.0005) deltaHtml = `<span class="answer-time">+${diff.toFixed(3)}s</span>`;
    }
    const pos = a.position || i + 1;
    const revealed = state.answersRevealed;
    const cls = [
      'answer-row',
      pos === 1 ? 'first' : '',
      state.answersGraded && revealed ? (a.is_correct ? 'is-correct' : 'is-wrong') : '',
    ].filter(Boolean).join(' ');
    const chip = revealed && a.option != null
      ? answerLabel(a.option)
      : '?';
    const chipCls = revealed && a.option != null ? 'answer-chip' : 'answer-chip hidden-answer';
    let pointsHtml = '';
    if (state.answersGraded && revealed) {
      const pts = Number(a.awarded_points) || 0;
      pointsHtml = a.is_correct
        ? `<span class="answer-points positive">+${pts}</span>`
        : '<span class="answer-points zero">0</span>';
    }
    return `
      <div class="${cls}">
        <span class="answer-pos">${pos}º</span>
        <span class="answer-name">${escapeHtml(a.player_name || 'Jogador')}</span>
        ${deltaHtml}
        <span class="${chipCls}" title="${revealed ? 'Resposta' : 'Resposta oculta até a revelação'}">${chip}</span>
        ${pointsHtml}
      </div>
    `;
  }).join('');

  if (!state.answersRevealed && state.currentRoundId && missing.length > 0) {
    const names = missing.map(p => `${escapeHtml(p.name)}${p.online === false ? ' (offline)' : ''}`).join(', ');
    html += `<p class="answers-waiting">⏳ Aguardando: ${names}</p>`;
  }

  container.innerHTML = html;
}

function renderCorrectAnswerPanel() {
  const panel = $('panel-correct-answer');
  const container = $('pres-correct-options');
  const hint = $('pres-correct-hint');
  if (!panel || !container) return;

  const visible = isAnswersGame() && state.answersRevealed;
  panel.classList.toggle('hidden', !visible);
  if (!visible) {
    container.innerHTML = '';
    return;
  }

  const cfg = answerConfig();
  const graded = state.answersGraded;
  const buttons = Array.from({ length: cfg.count }, (_, i) => {
    const option = i + 1;
    let cls = 'answer-choice';
    if (graded && state.correctOption === option) cls += ' correct';
    else if (!graded && state.pendingCorrectOption === option) cls += ' selected';
    else if (graded && state.correctOption != null) cls += ' wrong-choice';
    else if (!graded) cls += ' available';
    return `<button type="button" class="${cls}" data-option="${option}" ${graded ? 'disabled' : ''} onclick="chooseCorrectAnswer(${option})">${answerLabel(option)}</button>`;
  }).join('');

  let html = `<div class="answer-choice-grid">${buttons}</div>`;
  if (!graded && state.pendingCorrectOption != null) {
    html += `<button class="btn btn-confirm-correct" onclick="confirmCorrectAnswer()">✔ Confirmar resposta ${answerLabel(state.pendingCorrectOption)}</button>`;
  }
  container.innerHTML = html;

  if (hint) {
    if (graded && state.correctOption != null) {
      hint.textContent = `corrigida · resposta ${answerLabel(state.correctOption)}`;
    } else if (state.pendingCorrectOption != null) {
      hint.textContent = `confirmar ${answerLabel(state.pendingCorrectOption)}?`;
    } else {
      hint.textContent = 'escolha a alternativa';
    }
  }
}

function applyAnswersSnapshot(round) {
  if (round) {
    const sameRound = state.currentRoundId === round.id;
    state.currentRoundId = round.id;
    state.currentRoundNumber = round.round_number;
    state.answerOrder = round.answers || [];
    state.answersRevealed = round.answers_revealed === true;
    state.answersGraded = round.graded === true;
    state.correctOption = round.correct_option ?? null;
    state.answersEligible = Array.isArray(round.eligible_player_ids)
      ? round.eligible_player_ids
      : [];
    if (!sameRound) {
      state.pendingCorrectOption = null;
      state.gradingAnswers = false;
      state.revealingAnswers = false;
    }
    updateRoundDisplay(round.round_number);
    updateRoundButton(true);
    setupGameTypeLayout();
  } else {
    state.currentRoundId = null;
    state.currentRoundNumber = null;
    state.answerOrder = [];
    state.answersRevealed = false;
    state.answersGraded = false;
    state.correctOption = null;
    state.pendingCorrectOption = null;
    state.answersEligible = [];
    state.gradingAnswers = false;
    state.revealingAnswers = false;
    const total = Number(roomConfig().total_rounds) || 0;
    const nextNumber = total > 0
      ? Math.min(state.roundsPlayed + 1, total)
      : state.roundsPlayed + 1;
    updateRoundDisplay(nextNumber);
    updateRoundButton(false);
    setupGameTypeLayout();
  }
}

function handleRevealAnswers() {
  if (!isAnswersGame()) return;
  if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');
  if (state.answersRevealed) return;
  if (state.revealingAnswers) return;

  state.revealingAnswers = true;
  renderAnswerOrder();
  state.socket.emit('respostas:revelar', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
  }, (res) => {
    state.revealingAnswers = false;
    if (!res || !res.ok) {
      renderAnswerOrder();
      toast((res && res.error) || 'Não foi possível revelar as respostas');
    }
  });
}

function chooseCorrectAnswer(option) {
  if (!isAnswersGame() || !state.answersRevealed || state.answersGraded) return;
  const cfg = answerConfig();
  if (!Number.isInteger(option) || option < 1 || option > cfg.count) return;
  state.pendingCorrectOption = option;
  renderCorrectAnswerPanel();
}

function confirmCorrectAnswer() {
  if (!isAnswersGame() || !state.currentRoundId) return;
  if (!state.answersRevealed) return toast('Revele as respostas antes de corrigir');
  if (state.answersGraded) return toast('Esta rodada já foi corrigida');
  if (state.pendingCorrectOption == null) return toast('Escolha a resposta correta');
  if (state.gradingAnswers) return;

  state.gradingAnswers = true;
  state.socket.emit('resposta:corrigir', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    option: state.pendingCorrectOption,
  }, (res) => {
    if (!res || !res.ok) {
      state.gradingAnswers = false;
      toast((res && res.error) || 'Não foi possível corrigir a rodada');
    }
  });
}


function renderPresenterPlayers(players) {
  state.players = players; // Salva para re-render
  const container = $('pres-players');
  if (!players || players.length === 0) {
    container.innerHTML = '<p class="panel-empty">Nenhum jogador conectado</p>';
    return;
  }

  const ranked = players
    .filter(p => p.role === 'player')
    .sort((a, b) => (b.score_cache - a.score_cache) || a.name.localeCompare(b.name));

  if (ranked.length === 0) {
    container.innerHTML = '<p class="panel-empty">Nenhum jogador conectado</p>';
    return;
  }

  container.innerHTML = ranked.map(p => {
    // Standard Competition Ranking: quem tem pontos estritamente maiores vem antes.
    const rank = ranked.filter(other => other.score_cache > p.score_cache).length + 1;
    const medal = ['🥇', '🥈', '🥉'][rank - 1] || rank + 'º';
    const podiumCls = rank <= 3 ? ` podium-${rank}` : '';
    const online = p.online !== false;
    const penalty = p.penalty;
    const cls = `player-card${podiumCls}${online ? '' : ' is-offline'}${penalty ? ' is-punished' : ''}`;
    const presenceHtml = `<span class="presence-dot ${online ? 'online' : 'offline'}" title="${online ? 'Online' : 'Offline'}" aria-label="${online ? 'Online' : 'Offline'}"></span>`;
    const codeHtml = p.player_code ? `<span class="player-code" title="Código interno do jogador">#${escapeHtml(p.player_code)}</span>` : '';
    const dupHtml = p.is_duplicate ? `<span class="badge-dup" title="Nome duplicado na sala">⚠️</span>` : '';
    const penaltyTitle = penalty
      ? (penalty.active
        ? `Punido: ${penalty.rounds_remaining} rodada(s) sem buzinar`
        : `Punição começa na próxima rodada (${penalty.rounds_remaining} rodadas)`)
      : '';
    const penaltyHtml = penalty
      ? `<span class="badge-punish" title="${penaltyTitle}">🚫 ${penalty.rounds_remaining}</span>`
      : '';

    return `
      <div class="${cls}" id="pp-${p.user_id}">
        <span class="rank-medal" title="${rank}º lugar">${medal}</span>
        <div class="player-identity">
          ${presenceHtml}
          <span class="name">${escapeHtml(p.name)}</span>
          ${penaltyHtml}
          ${codeHtml}
          ${dupHtml}
        </div>
        <div class="player-score-actions">
          <span class="score" id="ps-${p.user_id}">${p.score_cache}</span>
          <button class="btn-kick" onclick="handleRemovePlayer('${p.user_id}')" title="Remover jogador" aria-label="Remover jogador">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderPresenterScores(scores) {
  if (!scores) return;
  let orderChanged = false;

  scores.forEach(s => {
    const prev = state.prevScoresByPid[s.player_id];
    if (prev === undefined) {
      // Primeiro status: apenas semeia os valores, sem remover ninguém da ordem.
      state.prevScoresByPid[s.player_id] = s.score;
    } else if (prev !== s.score) {
      state.prevScoresByPid[s.player_id] = s.score;
      // Quem recebeu/teve pontos retirados sai da lista de ordem dos botões.
      if (!state.judgedPlayers.has(s.player_id) &&
          state.buzzerOrder.some(o => o.player_id === s.player_id)) {
        state.judgedPlayers.add(s.player_id);
        orderChanged = true;
      }
    }

    const el = $('ps-' + s.player_id);
    if (el) el.textContent = s.score;
    // Atualiza o cache local para evitar reversão no re-render (ex: próxima rodada)
    const p = state.players?.find(p => p.user_id === s.player_id);
    if (p) {
      p.score_cache = s.score;
      p.penalty = s.penalty;
    }
  });

  if (orderChanged) {
    renderBuzzerOrderList();
    maybeAutoAdvanceRound();
  }
  // Reordena o placar conforme os pontos.
  if (state.players) renderPresenterPlayers(state.players);
}

function renderBuzzerOrder(order) {
  state.buzzerOrder = order || [];
  renderBuzzerOrderList();
}

function sortedBuzzerOrder() {
  return (state.buzzerOrder || []).slice().sort((a, b) => a.position - b.position);
}

// Cliques que ainda esperam uma decisão do apresentador (pontuar, punir ou
// tirar da lista). A lista de pendentes é a única fonte do auto-avanço.
function pendingBuzzerOrder() {
  const activeIds = new Set((state.players || []).filter(p => p.role === 'player').map(p => p.user_id));
  // Jogadores punidos não voltam para a lista de pendentes (inclusive após refresh).
  const punishedIds = new Set(
    (state.players || []).filter(p => p.role === 'player' && p.penalty).map(p => p.user_id)
  );
  return sortedBuzzerOrder().filter(o =>
    !state.judgedPlayers.has(o.player_id) &&
    !punishedIds.has(o.player_id) &&
    (activeIds.size === 0 || activeIds.has(o.player_id))
  );
}

// Com o auto-próxima ligado, a rodada só avança quando não sobra ninguém na
// lista de ordem dos botões.
function maybeAutoAdvanceRound() {
  if (isAnswersGame()) return; // Respostas só avança após a correção.
  if (!state.autoNextRound || !state.currentRoundId) return;
  if (pendingBuzzerOrder().length > 0) return;
  handleNextRound();
}

function renderBuzzerOrderList() {
  const container = $('pres-buzzer-order');
  if (!container) return;

  const rawOrder = sortedBuzzerOrder();
  const pending = pendingBuzzerOrder();

  if (pending.length === 0) {
    let message = 'Aguardando o início da rodada.';
    if (rawOrder.length > 0) message = 'Todos os cliques desta rodada já foram tratados.';
    else if (state.currentRoundId) message = 'Ninguém apertou o botão ainda.';
    container.innerHTML = `<p class="panel-empty">${message}</p>`;
    return;
  }

  const firstWithTs = rawOrder.find(o => o.timestamp);
  const firstTs = firstWithTs ? new Date(firstWithTs.timestamp).getTime() : null;
  const cfg = roomConfig();
  const exactPoints = Number(cfg.points_exact) || 0;
  const nearPoints = Number(cfg.points_near) || 0;
  const punishTitle = cfg.penalty_type === 'points'
    ? `Errou: −${cfg.penalty_points} ponto(s)`
    : `Errou: ${cfg.penalty_rounds} rodada(s) sem buzinar`;

  container.innerHTML = pending.map((o, i) => {
    let deltaHtml = '';
    if (firstTs && o.timestamp) {
      const diff = (new Date(o.timestamp).getTime() - firstTs) / 1000;
      if (diff > 0.0005) deltaHtml = `<span class="buzz-time">+${diff.toFixed(3)}s</span>`;
    }
    // A posição é a ordem original do clique e não muda quando o jogador é pontuado.
    const pos = o.position || i + 1;
    return `
      <div class="buzz-row${pos === 1 ? ' first' : ''}">
        <span class="buzz-pos">${pos}º</span>
        <span class="buzz-name">${escapeHtml(o.player_name || 'Jogador')}</span>
        ${deltaHtml}
        <div class="buzz-actions">
          <button class="btn-plus" onclick="changeScore('${o.player_id}', 'exact')" title="+${exactPoints} ponto(s)">+${exactPoints}</button>
          <button class="btn-plus" onclick="changeScore('${o.player_id}', 'near')" title="+${nearPoints} ponto(s)">+${nearPoints}</button>
          <button class="btn-punish" onclick="punishPlayer('${o.player_id}')" title="${escapeHtml(punishTitle)}" aria-label="Punir jogador">Errou</button>
          <button class="btn-dismiss" onclick="dismissBuzzerPlayer('${o.player_id}')" title="Tirar da lista (sem pontos nem punição)" aria-label="Tirar da lista sem pontos nem punição">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateRoundButton(isRoundActive) {
  const btn = $('btn-round-control');
  if (!btn) return;

  btn.disabled = false;
  if (isRoundActive) {
    btn.textContent = '⏭ Próxima Rodada';
    btn.className = 'btn btn-warning';
  } else if (roundsLimitReached()) {
    btn.textContent = '🏁 Rodadas encerradas';
    btn.className = 'btn btn-outline';
    btn.disabled = true;
  } else {
    btn.textContent = '▶ Começar Rodada';
    btn.className = 'btn btn-success';
  }
}

function applyRoundSnapshot(round) {
  if (isAnswersGame()) {
    applyAnswersSnapshot(round);
    return;
  }

  if (round) {
    const sameRound = state.currentRoundId === round.id;
    state.currentRoundId = round.id;
    state.currentRoundNumber = round.round_number;
    state.buzzerOrder = round.buzzer_order || [];
    // Ao reconectar no meio da rodada, mantém quem já foi pontuado fora da ordem.
    if (!sameRound) state.judgedPlayers.clear();
    // Jogadores já punidos também saem da lista de pendentes.
    const punishedIds = new Set((state.players || []).filter(p => p.penalty).map(p => p.user_id));
    for (const entry of state.buzzerOrder) {
      if (punishedIds.has(entry.player_id)) state.judgedPlayers.add(entry.player_id);
    }
    updateRoundDisplay(round.round_number);
    updateRoundButton(true);
    renderBuzzerOrder(state.buzzerOrder);
  } else {
    state.currentRoundId = null;
    state.currentRoundNumber = null;
    state.buzzerOrder = [];
    state.judgedPlayers.clear();
    state.advancingRound = false;
    const total = Number(roomConfig().total_rounds) || 0;
    const nextNumber = total > 0
      ? Math.min(state.roundsPlayed + 1, total)
      : state.roundsPlayed + 1;
    updateRoundDisplay(nextNumber);
    updateRoundButton(false);
    renderBuzzerOrder([]);
  }
}

function handleRoundControl() {
  if (state.currentRoundId) {
    // No tipo Respostas, evita pular uma rodada que ainda não foi corrigida
    // por engano (todos ficariam sem pontos).
    if (isAnswersGame() && !state.answersGraded) {
      if (!confirm('A rodada ainda não foi corrigida. Avançar sem pontuar?')) return;
    }
    // Se há uma rodada ativa, finaliza ela. 
    // O evento 'rodada:proxima' recebido via socket irá disparar o início da próxima automaticamente.
    handleNextRound();
  } else {
    handleStartRound();
  }
}

function handleStartRound() {
  if (roundsLimitReached()) {
    toast('Todas as rodadas já foram jogadas. Reinicie a partida para jogar novamente.');
    return;
  }
  state.socket.emit('rodada:iniciar', {
    room_id: state.room.id,
    media_url: '',
    correct_answer: '',
  });
}

function handleNextRound() {
  if (!state.currentRoundId || state.advancingRound) return;
  // Evita pedir a próxima rodada mais de uma vez enquanto o servidor responde.
  state.advancingRound = true;
  state.socket.emit('rodada:proxima', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
  });
}

function toggleAutoNextRound(checked) {
  state.autoNextRound = checked;
}


// ─── Vídeo YouTube ─────────────────────────────
function toggleVideoPanel() {
  state.showVideo = !state.showVideo;
  const panel = $('video-panel');
  const toggle = $('btn-video-toggle');
  panel.classList.toggle('hidden', !state.showVideo);
  toggle.classList.toggle('active', state.showVideo);
  document.querySelector('.content').classList.toggle('layout-video', state.showVideo);
  if (state.showVideo) {
    if (state.videoId) {
      $('video-container').classList.remove('hidden');
      $('video-empty').classList.add('hidden');
    } else {
      $('video-url').focus();
    }
  }
}

function loadVideo() {
  const input = $('video-url');
  const url = input.value.trim();
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    toast('URL do YouTube inválida');
    return;
  }
  openVideo(url, videoId);
}

// Abre o painel e carrega o player. Usado pelo botão "Carregar" e pela URL
// configurada na criação da sala (carregamento automático).
function openVideo(url, videoId) {
  state.videoUrl = url;
  state.videoId = videoId;
  state.showVideo = true;
  $('btn-video-toggle').classList.add('active');
  $('video-panel').classList.remove('hidden');
  $('video-input-row').classList.add('hidden');
  document.querySelector('.content').classList.add('layout-video');
  showVideoEmbed(videoId);
}

function showVideoEmbed(videoId) {
  const container = $('video-container');
  container.classList.remove('hidden');
  $('video-empty').classList.add('hidden');
  const existing = container.querySelector('iframe');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0&controls=0&modestbranding=1';
  iframe.setAttribute('allow', 'autoplay; encrypted-media');
  iframe.setAttribute('allowfullscreen', '');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  container.appendChild(iframe);
}

function closeVideo() {
  state.showVideo = false;
  state.videoUrl = '';
  state.videoId = '';
  $('video-input-row').classList.remove('hidden');
  $('video-container').classList.add('hidden');
  $('video-container').innerHTML = '<div class="video-empty" id="video-empty">Cole a URL do YouTube e clique em Carregar</div>';
  $('video-empty').classList.remove('hidden');
  // Mantém a URL configurada na sala para recarregar sem digitar de novo.
  $('video-url').value = state.quizUrl || '';
  $('video-panel').classList.add('hidden');
  $('btn-video-toggle').classList.remove('active');
  document.querySelector('.content').classList.remove('layout-video');
}

function extractYouTubeId(url) {
  var m = url.match(/^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[?&#].*)?$/i);
  if (m) return m[1];
  m = url.match(/^([a-zA-Z0-9_-]{11})$/);
  return m ? m[1] : null;
}

function changeScore(playerId, judgment) {
  if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');
  // Ao pontuar, o jogador sai imediatamente da lista de ordem dos botões.
  if (state.buzzerOrder.some(o => o.player_id === playerId)) {
    state.judgedPlayers.add(playerId);
    renderBuzzerOrderList();
  }
  // O servidor calcula o delta a partir da configuração da sala.
  state.socket.emit('pontos:alterar', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    player_id: playerId,
    judgment,
  });
  maybeAutoAdvanceRound();
}

function punishPlayer(playerId) {
  if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');

  const player = state.players?.find(p => p.user_id === playerId);
  if (player?.penalty) return toast(`${player.name} já está cumprindo punição`);

  state.socket.emit('jogador:punir', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    player_id: playerId,
  }, (res) => {
    if (!res || !res.ok) {
      toast((res && res.error) || 'Não foi possível aplicar a punição');
    }
  });
}

// Tira o jogador da lista de pendentes da rodada sem somar/descontar pontos e
// sem aplicar punição. É o que permite esvaziar a lista para o auto-avanço.
function dismissBuzzerPlayer(playerId) {
  if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');

  const entry = (state.buzzerOrder || []).find(o => o.player_id === playerId);
  if (!entry) return;

  state.judgedPlayers.add(playerId);
  renderBuzzerOrderList();
  toast(`${entry.player_name || 'Jogador'} saiu da lista sem pontos nem punição`);
  maybeAutoAdvanceRound();
}

function handleRemovePlayer(userId) {
  const player = state.players?.find(p => p.user_id === userId);
  if (!player) return;

  const status = player.online === false ? ' (offline)' : ' (online)';
  if (!confirm(`Remover ${player.name}${status} da sala?\n\nA pontuação sai do placar e a sessão é removida. Para desfazer, reinicie a partida ou encerre a sala.`)) return;

  state.socket.emit('jogador:remover', { room_id: state.room.id, user_id: userId }, (res) => {
    if (!res || !res.ok) {
      toast((res && res.error) || 'Não foi possível remover o jogador');
      return;
    }
    state.judgedPlayers.add(userId);
    renderBuzzerOrderList();
    toast(`${player.name} removido da sala`);
  });
}

function openScore() {
  if (!state.room?.code) return;
  window.open('/score?sala=' + encodeURIComponent(state.room.code), '_blank');
}

function handleResetGame() {
  if (!confirm('Deseja realmente REINICIAR a partida?\n\nIsso irá:\n- Zerar todos os pontos\n- Remover as punições\n- Resetar o contador de rodadas para 1\n\nEssa ação não pode ser desfeita.')) return;
  
  state.socket.emit('jogo:resetar', {
    room_id: state.room.id
  });
  
  toggleMenu('pres-menu'); // Fecha o menu após clicar
}

function handleCloseRoom() {
  if (!confirm('Encerrar a sala?')) return;
  api('/rooms/' + state.room.id, null, 'DELETE').finally(() => {
    localStorage.removeItem('last_room_code');
    if (state.socket) state.socket.disconnect();
    location.href = '/';
  });
}

function connectPresenterSocket() {
  state.socket = io('/', { query: { room_id: state.room.id, user_id: state.user.id } });

  state.socket.on('connect_error', (err) => toast('Erro de conexão: ' + err.message));

  state.socket.on('sala:status', (data) => {
    state.room = { ...state.room, ...data.room };
    state.roundsPlayed = Number(data.rounds_played) || 0;
    renderPresenterPlayers(data.players);
    applyRoundSnapshot(data.current_round);
    renderPresenterScores(data.scores);
  });

  state.socket.on('sala:jogadores', (data) => renderPresenterPlayers(data.players));

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    state.currentRoundNumber = data.round_number;
    state.roundsPlayed = data.round_number;
    state.advancingRound = false;
    updateRoundDisplay(data.round_number);
    updateRoundButton(true);

    if (isAnswersGame()) {
      state.answerOrder = [];
      state.answersRevealed = false;
      state.answersGraded = false;
      state.correctOption = null;
      state.pendingCorrectOption = null;
      state.answersEligible = Array.isArray(data.eligible_player_ids)
        ? data.eligible_player_ids
        : [];
      state.gradingAnswers = false;
      state.revealingAnswers = false;
      renderPresenterPlayers(state.players || []);
      setupGameTypeLayout();
      showRoundGo();
      return;
    }

    state.buzzerOrder = [];
    state.judgedPlayers.clear();
    renderBuzzerOrder([]);
    renderPresenterPlayers(state.players || []);
    showRoundGo();
  });

  state.socket.on('buzina:ordem', (data) => {
    if (isAnswersGame()) return;
    renderBuzzerOrder(data.order || []);
  });

  // ─── Tipo Respostas ─────────────────────────────
  state.socket.on('respostas:ordem', (data) => {
    if (!isAnswersGame() || !data) return;
    state.answerOrder = data.answers || [];
    state.answersRevealed = data.answers_revealed === true;
    state.answersGraded = data.graded === true;
    state.correctOption = data.correct_option ?? null;
    if (Array.isArray(data.eligible_player_ids)) {
      state.answersEligible = data.eligible_player_ids;
    }
    setupGameTypeLayout();
  });

  state.socket.on('respostas:reveladas', (data) => {
    if (!isAnswersGame() || !data) return;
    const wasRevealed = state.answersRevealed;
    state.answerOrder = data.answers || [];
    state.answersRevealed = true;
    state.answersGraded = data.graded === true;
    state.correctOption = data.correct_option ?? null;
    state.pendingCorrectOption = null;
    state.revealingAnswers = false;
    if (Array.isArray(data.eligible_player_ids)) {
      state.answersEligible = data.eligible_player_ids;
    }
    setupGameTypeLayout();
    if (!wasRevealed) toast('Respostas reveladas! Escolha a resposta correta.');
  });

  state.socket.on('respostas:corrigidas', (data) => {
    if (!isAnswersGame() || !data) return;
    state.answerOrder = data.answers || state.answerOrder;
    state.answersRevealed = true;
    state.answersGraded = true;
    state.correctOption = data.correct_option ?? null;
    state.pendingCorrectOption = null;
    state.gradingAnswers = false;
    if (Array.isArray(data.eligible_player_ids)) {
      state.answersEligible = data.eligible_player_ids;
    }
    setupGameTypeLayout();

    // Auto-próxima: só depois da correção (senão ninguém pontuaria).
    if (state.autoNextRound && !roundsLimitReached()) {
      setTimeout(() => {
        if (state.autoNextRound && state.currentRoundId && !state.advancingRound) {
          handleNextRound();
        }
      }, 900);
    }
  });

  state.socket.on('placar:atualizado', (data) => renderPresenterScores(data.scores));

  state.socket.on('jogador:punido', (data) => {
    if (!data) return;
    if (state.buzzerOrder.some(o => o.player_id === data.player_id)) {
      state.judgedPlayers.add(data.player_id);
      renderBuzzerOrderList();
      maybeAutoAdvanceRound();
    }
    if (data.penalty_type === 'points') {
      toast(`${data.player_name} errou: −${data.points_subtracted} ponto(s)`);
    } else {
      toast(`${data.player_name} punido: ${data.duration_rounds} rodada(s) sem buzinar`);
    }
  });

  state.socket.on('rodada:proxima', () => {
    state.currentRoundId = null;
    state.currentRoundNumber = null;
    state.buzzerOrder = [];
    state.judgedPlayers.clear();
    state.advancingRound = false;
    state.answerOrder = [];
    state.answersRevealed = false;
    state.answersGraded = false;
    state.correctOption = null;
    state.pendingCorrectOption = null;
    state.answersEligible = [];
    state.gradingAnswers = false;
    state.revealingAnswers = false;
    updateRoundButton(false);
    renderBuzzerOrder([]);
    renderPresenterPlayers(state.players || []);
    setupGameTypeLayout();

    // Inicia a próxima rodada automaticamente, exceto quando o limite acabou.
    if (roundsLimitReached()) {
      toast('🏁 Fim! Todas as rodadas foram jogadas.');
      return;
    }
    setTimeout(() => handleStartRound(), 500);
  });

  state.socket.on('erro', (data) => {
    state.gradingAnswers = false;
    state.revealingAnswers = false;
    if (isAnswersGame()) {
      renderAnswerOrder();
      renderCorrectAnswerPanel();
    }
    toast(data.message);
  });
}

// ─── Init ─────────────────────────────────────────
if (window.__PRESENTER_DEMO__) {
  // O modo de exemplo é inicializado por /js/apresentador-demo.js.
} else {
  setupAuth()
    .then(() => requireRoom(getRoomCodeFromUrl()))
    .then(room => {
      if (room.presenter_id !== state.user.id) {
        location.href = '/jogador?sala=' + room.code;
        return;
      }
      $('pres-code').textContent = room.code;
      const roomTitle = room.title || 'Quiz Show';
      $('pres-title').textContent = roomTitle;
      $('pres-round-room-title').textContent = roomTitle;
      document.title = roomTitle + ' — Apresentador';

      // URL configurada na criação da sala (opcional): já carrega o vídeo.
      state.quizUrl = room.type === 'answers'
        ? (room.config && room.config.video_url) || ''
        : (room.config && room.config.quiz_url) || '';
      $('video-url').value = state.quizUrl;
      if (state.quizUrl) {
        const videoId = extractYouTubeId(state.quizUrl);
        if (videoId) openVideo(state.quizUrl, videoId);
      }
      updateRoundDisplay(1);
      setupGameTypeLayout();

      connectPresenterSocket();
    })
    .catch(() => { /* redirect já feito por setupAuth/requireRoom */ });
}
