// Estado específico do apresentador
state.currentRoundId = null;
state.answers = {};
state.buzzerOrder = [];

function renderPresenterPlayers(players) {
  state.players = players; // Salva para re-render
  const container = $('pres-players');
  if (!players || players.length === 0) {
    container.innerHTML = '<p style="color:#636e72;">Nenhum jogador conectado</p>';
    return;
  }

  const order = state.buzzerOrder || [];
  
  // Criar lista enriquecida com info de buzina
  const enrichedPlayers = players.filter(p => p.role === 'player').map(p => {
    const buzzInfo = order.find(o => o.player_id === p.user_id);
    return { ...p, buzzPos: buzzInfo?.position };
  });

  // Reordenar: quem buzinou primeiro no topo, depois por nome
  enrichedPlayers.sort((a, b) => {
    if (a.buzzPos && b.buzzPos) return a.buzzPos - b.buzzPos;
    if (a.buzzPos) return -1;
    if (b.buzzPos) return 1;
    return a.name.localeCompare(b.name);
  });

  container.innerHTML = enrichedPlayers.map(p => {
    const isBuzzed = !!p.buzzPos;
    const isFirst = p.buzzPos === 1;
    const cls = `player-card ${isBuzzed ? 'is-buzzed' : ''} ${isFirst ? 'is-first-buzz' : ''}`;
    const buzzHtml = isBuzzed ? `<span class="buzz-pos">${p.buzzPos}º</span>` : '';
    
    return `
      <div class="${cls}" id="pp-${p.user_id}">
        <div style="display:flex;align-items:center;">
          ${buzzHtml}
          <span class="name">${escapeHtml(p.name)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:.75rem;">
          <span class="score" id="ps-${p.user_id}">${p.score_cache}</span>
          <div class="score-actions">
            <button class="btn-plus" onclick="changeScore('${p.user_id}', 3)">+3</button>
            <button class="btn-plus" onclick="changeScore('${p.user_id}', 1)">+1</button>
            <button class="btn-minus" onclick="changeScore('${p.user_id}', -2)">-2</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPresenterScores(scores) {
  if (!scores) return;
  scores.forEach(s => {
    const el = $('ps-' + s.player_id);
    if (el) el.textContent = s.score;
    // Atualiza o cache local para evitar reversão no re-render (ex: próxima rodada)
    const p = state.players?.find(p => p.user_id === s.player_id);
    if (p) p.score_cache = s.score;
  });
}

function renderBuzzerOrder(order) {
  // A ordem agora é renderizada dentro de renderPresenterPlayers usando o estado sincronizado
  if (state.players) renderPresenterPlayers(state.players);
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

function updateRoundButton(isRoundActive) {
  const btn = $('btn-round-control');
  if (!btn) return;
  
  if (isRoundActive) {
    btn.textContent = '⏭ Próxima Rodada';
    btn.className = 'btn btn-warning';
  } else {
    btn.textContent = '▶ Começar Rodada';
    btn.className = 'btn btn-success';
  }
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
    updateRoundButton(true);
    renderBuzzerOrder(state.buzzerOrder);
    renderAnswers();
  } else {
    state.currentRoundId = null;
    state.buzzerOrder = [];
    state.answers = {};
    $('pres-round-num').textContent = '1';
    updateRoundButton(false);
    renderBuzzerOrder([]);
    renderAnswers();
  }
}

function handleRoundControl() {
  if (state.currentRoundId) {
    // Se há uma rodada ativa, finaliza ela. 
    // O evento 'rodada:proxima' recebido via socket irá disparar o início da próxima automaticamente.
    handleNextRound();
  } else {
    handleStartRound();
  }
}

function handleStartRound() {
  state.socket.emit('rodada:iniciar', {
    room_id: state.room.id,
    media_url: '',
    correct_answer: '',
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

function handleResetGame() {
  if (!confirm('Deseja realmente REINICIAR a partida?\n\nIsso irá:\n- Zerar todos os pontos\n- Resetar o contador de rodadas para 1\n\nEssa ação não pode ser desfeita.')) return;
  
  state.socket.emit('jogo:resetar', {
    room_id: state.room.id
  });
  
  toggleMenu('pres-menu'); // Fecha o menu após clicar
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
    applyRoundSnapshot(data.current_round);
    renderPresenterPlayers(data.players);
    renderPresenterScores(data.scores);
  });

  state.socket.on('sala:jogadores', (data) => renderPresenterPlayers(data.players));

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    state.answers = {};
    state.buzzerOrder = [];
    $('pres-round-num').textContent = data.round_number;
    updateRoundButton(true);
    renderPresenterPlayers(state.players || []); // Forçar re-render para limpar buzinas
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
    updateRoundButton(false);
    renderPresenterPlayers(state.players || []); // Limpar visuais de buzina
    renderAnswers();
    
    // Inicia a próxima rodada automaticamente após o encerramento da anterior
    setTimeout(() => handleStartRound(), 500);
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
    const roomTitle = room.title || 'Quiz Show';
    $('pres-title').textContent = roomTitle;
    $('pres-round-room-title').textContent = roomTitle;
    document.title = roomTitle + ' — Apresentador';
    connectPresenterSocket();
  })
  .catch(() => { /* redirect já feito por setupAuth/requireRoom */ });
