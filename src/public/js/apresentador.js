// Estado específico do apresentador
state.currentRoundId = null;
state.buzzerOrder = [];
state.autoNextRound = false;
state.showVideo = false;
state.videoUrl = '';
state.videoId = '';
state.judgedPlayers = new Set();
state.prevScoresByPid = {};

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
    const cls = `player-card${podiumCls}${online ? '' : ' is-offline'}`;
    const presenceHtml = `<span class="presence-dot ${online ? 'online' : 'offline'}" title="${online ? 'Online' : 'Offline'}" aria-label="${online ? 'Online' : 'Offline'}"></span>`;
    const codeHtml = p.player_code ? `<span class="player-code" title="Código interno do jogador">#${escapeHtml(p.player_code)}</span>` : '';
    const dupHtml = p.is_duplicate ? `<span class="badge-dup" title="Nome duplicado na sala">⚠️</span>` : '';

    return `
      <div class="${cls}" id="pp-${p.user_id}">
        <span class="rank-medal" title="${rank}º lugar">${medal}</span>
        <div class="player-identity">
          ${presenceHtml}
          <span class="name">${escapeHtml(p.name)}</span>
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
    if (p) p.score_cache = s.score;
  });

  if (orderChanged) renderBuzzerOrderList();
  // Reordena o placar conforme os pontos.
  if (state.players) renderPresenterPlayers(state.players);
}

function renderBuzzerOrder(order) {
  state.buzzerOrder = order || [];
  renderBuzzerOrderList();
}

function renderBuzzerOrderList() {
  const container = $('pres-buzzer-order');
  if (!container) return;

  const rawOrder = (state.buzzerOrder || []).slice().sort((a, b) => a.position - b.position);
  const activeIds = new Set((state.players || []).filter(p => p.role === 'player').map(p => p.user_id));
  const pending = rawOrder.filter(o =>
    !state.judgedPlayers.has(o.player_id) &&
    (activeIds.size === 0 || activeIds.has(o.player_id))
  );

  if (pending.length === 0) {
    let message = 'Aguardando o início da rodada.';
    if (rawOrder.length > 0) message = 'Todos os cliques já foram pontuados.';
    else if (state.currentRoundId) message = 'Ninguém apertou o botão ainda.';
    container.innerHTML = `<p class="panel-empty">${message}</p>`;
    return;
  }

  const firstWithTs = rawOrder.find(o => o.timestamp);
  const firstTs = firstWithTs ? new Date(firstWithTs.timestamp).getTime() : null;

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
          <button class="btn-plus" onclick="changeScore('${o.player_id}', 3)" title="+3 pontos">+3</button>
          <button class="btn-plus" onclick="changeScore('${o.player_id}', 1)" title="+1 ponto">+1</button>
          <button class="btn-minus" onclick="changeScore('${o.player_id}', -2)" title="-2 pontos">-2</button>
        </div>
      </div>
    `;
  }).join('');
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
    const sameRound = state.currentRoundId === round.id;
    state.currentRoundId = round.id;
    state.buzzerOrder = round.buzzer_order || [];
    // Ao reconectar no meio da rodada, mantém quem já foi pontuado fora da ordem.
    if (!sameRound) state.judgedPlayers.clear();
    $('pres-round-num').textContent = round.round_number;
    updateRoundButton(true);
    renderBuzzerOrder(state.buzzerOrder);
  } else {
    state.currentRoundId = null;
    state.buzzerOrder = [];
    state.judgedPlayers.clear();
    $('pres-round-num').textContent = '1';
    updateRoundButton(false);
    renderBuzzerOrder([]);
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
  $('video-url').value = '';
  $('video-panel').classList.add('hidden');
  $('btn-video-toggle').classList.remove('active');
  document.querySelector('.content').classList.remove('layout-video');
}

function extractYouTubeId(url) {
  var m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/^([a-zA-Z0-9_-]{11})$/);
  return m ? m[1] : null;
}

function changeScore(playerId, delta) {
  if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');
  // Ao pontuar, o jogador sai imediatamente da lista de ordem dos botões.
  if (state.buzzerOrder.some(o => o.player_id === playerId)) {
    state.judgedPlayers.add(playerId);
    renderBuzzerOrderList();
  }
  state.socket.emit('pontos:alterar', {
    room_id: state.room.id,
    round_id: state.currentRoundId,
    player_id: playerId,
    score_delta: delta,
  });
  if (state.autoNextRound) {
    handleNextRound();
  }
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
  if (!confirm('Deseja realmente REINICIAR a partida?\n\nIsso irá:\n- Zerar todos os pontos\n- Resetar o contador de rodadas para 1\n\nEssa ação não pode ser desfeita.')) return;
  
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
    renderPresenterPlayers(data.players);
    applyRoundSnapshot(data.current_round);
    renderPresenterScores(data.scores);
  });

  state.socket.on('sala:jogadores', (data) => renderPresenterPlayers(data.players));

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    state.buzzerOrder = [];
    state.judgedPlayers.clear();
    $('pres-round-num').textContent = data.round_number;
    updateRoundButton(true);
    renderBuzzerOrder([]);
    renderPresenterPlayers(state.players || []);
    showRoundGo();
  });

  state.socket.on('buzina:ordem', (data) => {
    renderBuzzerOrder(data.order || []);
  });

  state.socket.on('placar:atualizado', (data) => renderPresenterScores(data.scores));

  state.socket.on('rodada:proxima', () => {
    state.currentRoundId = null;
    state.buzzerOrder = [];
    state.judgedPlayers.clear();
    updateRoundButton(false);
    renderBuzzerOrder([]);
    renderPresenterPlayers(state.players || []);
    
    // Inicia a próxima rodada automaticamente após o encerramento da anterior
    setTimeout(() => handleStartRound(), 500);
  });

  state.socket.on('erro', (data) => toast(data.message));
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
      connectPresenterSocket();
    })
    .catch(() => { /* redirect já feito por setupAuth/requireRoom */ });
}
