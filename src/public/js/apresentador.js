// Estado específico do apresentador
state.currentRoundId = null;
state.answers = {};
state.buzzerOrder = [];

function renderPresenterPlayers(players) {
  const container = $('pres-players');
  if (!players || players.length === 0) {
    container.innerHTML = '<p style="color:#636e72;">Nenhum jogador conectado</p>';
    return;
  }
  container.innerHTML = players.filter(p => p.role === 'player').map(p => `
    <div class="player-card" id="pp-${p.user_id}">
      <div><span class="name">${escapeHtml(p.name)}</span></div>
      <div style="display:flex;align-items:center;gap:.75rem;">
        <span class="score" id="ps-${p.user_id}">${p.score_cache}</span>
        <div class="score-actions">
          <button class="btn-plus" onclick="changeScore('${p.user_id}', 3)">+3</button>
          <button class="btn-plus" onclick="changeScore('${p.user_id}', 1)">+1</button>
          <button class="btn-minus" onclick="changeScore('${p.user_id}', -2)">-2</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPresenterScores(scores) {
  if (!scores) return;
  scores.forEach(s => {
    const el = $('ps-' + s.player_id);
    if (el) el.textContent = s.score;
  });
}

function renderBuzzerOrder(order) {
  if (!order || order.length === 0) {
    $('pres-buzzer-order').innerHTML = '<p style="color:#636e72;">Aguardando jogadores...</p>';
    return;
  }
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const html = order.map(o => {
    const medal = medals[o.position] || '';
    const cls = o.position === 1 ? 'pos first-buzz' : 'pos';
    return `<span class="${cls}"><span class="num">${o.position}º</span> ${medal} ${escapeHtml(o.player_name)}</span>`;
  }).join('');
  $('pres-buzzer-order').innerHTML = `<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;">${html}</div>`;
}

function renderAnswers() {
  const container = $('pres-answers');
  const order = state.buzzerOrder || [];
  const seen = new Set();
  const sorted = [];
  order.forEach(o => {
    if (state.answers[o.player_id]) {
      sorted.push({ position: o.position, ...state.answers[o.player_id] });
      seen.add(o.player_id);
    }
  });
  Object.entries(state.answers).forEach(([pid, a]) => {
    if (!seen.has(pid)) sorted.push({ position: null, ...a });
  });
  const items = sorted.map(a => `
    <div class="player-card">
      <span class="name">${a.position ? `<span style="color:#6c5ce7;">${a.position}º</span> ` : ''}${escapeHtml(a.player_name || '')}</span>
      <span style="color:#fdcb6e;">${escapeHtml(a.text || '')}</span>
    </div>
  `).join('');
  container.innerHTML = items || '<p style="color:#636e72;">Nenhuma resposta ainda</p>';
}

function applyRoundSnapshot(round) {
  if (round) {
    state.currentRoundId = round.id;
    state.buzzerOrder = round.buzzer_order || [];
    state.answers = {};
    (round.answers || []).forEach(a => {
      state.answers[a.player_id] = { player_name: a.player_name, text: a.text };
    });
    $('pres-round-num').textContent = round.round_number;
    $('pres-round-info').classList.remove('hidden');
    $('btn-start-round').disabled = true;
    $('btn-next-round').disabled = false;
    renderBuzzerOrder(state.buzzerOrder);
    renderAnswers();
  } else {
    state.currentRoundId = null;
    state.buzzerOrder = [];
    state.answers = {};
    $('pres-round-info').classList.add('hidden');
    $('btn-start-round').disabled = false;
    $('btn-next-round').disabled = true;
    renderBuzzerOrder([]);
    renderAnswers();
  }
}

function handleStartRound() {
  const mediaUrl = $('pres-media-url').value.trim();
  const correctAnswer = $('pres-correct-answer').value.trim();
  state.socket.emit('rodada:iniciar', {
    room_id: state.room.id,
    media_url: mediaUrl,
    correct_answer: correctAnswer,
  });
}

function handleNextRound() {
  if (!state.currentRoundId) return;
  state.socket.emit('rodada:proxima', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
  });
}

function changeScore(playerId, delta) {
  if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');
  state.socket.emit('pontos:alterar', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    player_id: playerId,
    score_delta: delta,
    judgment: delta > 0 ? (delta >= 3 ? 'na_mosca' : 'raspando') : 'errado',
  });
}

function openScore() {
  if (!state.room?.code) return;
  window.open('/score?sala=' + encodeURIComponent(state.room.code), '_blank');
}

function handleCloseRoom() {
  if (!confirm('Encerrar a sala?')) return;
  api('/rooms/' + state.room.id, null);
  localStorage.removeItem('last_room_code');
  if (state.socket) state.socket.disconnect();
  location.href = '/';
}

function connectPresenterSocket() {
  state.socket = io('/', { query: { room_id: state.room.id, user_id: state.user.id } });

  state.socket.on('connect_error', (err) => toast('Erro de conexão: ' + err.message));

  state.socket.on('sala:status', (data) => {
    state.room = { ...state.room, ...data.room };
    renderPresenterPlayers(data.players);
    renderPresenterScores(data.scores);
    applyRoundSnapshot(data.current_round);
  });

  state.socket.on('sala:jogadores', (data) => renderPresenterPlayers(data.players));

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    state.answers = {};
    state.buzzerOrder = [];
    $('pres-round-num').textContent = data.round_number;
    $('pres-round-info').classList.remove('hidden');
    $('btn-start-round').disabled = true;
    $('btn-next-round').disabled = false;
    $('pres-buzzer-order').innerHTML = '<p style="color:#636e72;">Aguardando jogadores...</p>';
    renderAnswers();
    showRoundGo();
  });

  state.socket.on('buzina:ordem', (data) => {
    state.buzzerOrder = data.order;
    renderBuzzerOrder(data.order);
    renderAnswers();
  });

  state.socket.on('resposta:atualizada', (data) => {
    state.answers[data.player_id] = { player_name: data.player_name, text: data.text };
    renderAnswers();
  });

  state.socket.on('placar:atualizado', (data) => renderPresenterScores(data.scores));

  state.socket.on('rodada:proxima', () => {
    state.currentRoundId = null;
    state.answers = {};
    state.buzzerOrder = [];
    $('pres-round-info').classList.add('hidden');
    $('btn-start-round').disabled = false;
    $('btn-next-round').disabled = true;
    $('pres-media-url').value = '';
    $('pres-correct-answer').value = '';
    $('pres-buzzer-order').innerHTML = '<p style="color:#636e72;">Aguardando...</p>';
    renderAnswers();
  });

  state.socket.on('erro', (data) => toast(data.message));
}

// ─── Init ─────────────────────────────────────────
setupAuth()
  .then(() => requireRoom(getRoomCodeFromUrl()))
  .then(room => {
    if (room.presenter_id !== state.user.id) {
      location.href = '/jogador?sala=' + room.code;
      return;
    }
    $('pres-code').textContent = room.code;
    $('pres-title').textContent = room.title || 'Quiz Show';
    connectPresenterSocket();
  })
  .catch(() => { /* redirect já feito por setupAuth/requireRoom */ });
