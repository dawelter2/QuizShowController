state.currentRoundId = null;
let answerTimeout = null;
let allScores = [];

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

function renderBuzzerOrder(order) {
  const orderEl = $('player-buzzer-order');
  if (!order || order.length === 0) { orderEl.innerHTML = ''; return; }
  const html = order.map(o =>
    `<span class="pos"><span class="num">${o.position}º</span> ${escapeHtml(o.player_name)}</span>`
  ).join('');
  orderEl.innerHTML = `<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;">${html}</div>`;
}

function applyRoundSnapshot(round) {
  const answer = $('player-answer');
  const buzzer = $('player-buzzer');
  if (round && round.status === 'active') {
    state.currentRoundId = round.id;
    $('player-status-round-num').textContent = round.round_number;
    const order = round.buzzer_order || [];
    const myBuzz = order.find(o => o.player_id === state.user.id);
    setBuzzerState(myBuzz ? 'pressed' : 'active');
    updateBuzzerBadge(myBuzz?.position);
    buzzer.classList.toggle('first-buzz', order[0]?.player_id === state.user.id);
    answer.disabled = false;
    const myAnswer = (round.answers || []).find(a => a.player_id === state.user.id);
    answer.value = myAnswer?.text || '';
    renderBuzzerOrder(order);
  } else {
    state.currentRoundId = null;
    $('player-status-round-num').textContent = '1';
    setBuzzerState('disabled');
    updateBuzzerBadge(null);
    buzzer.classList.remove('first-buzz');
    answer.disabled = true;
    answer.value = '';
    renderBuzzerOrder([]);
  }
}

function handleBuzz(event) {
  if (!state.currentRoundId) return toast('Nenhuma rodada ativa');
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
    const me = data.scores?.find(s => s.player_id === state.user.id);
    if (me) $('player-score').textContent = me.score;
    allScores = data.scores || [];
    updatePlayerRank(allScores);
    applyRoundSnapshot(data.current_round);
  });

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    $('player-status-round-num').textContent = data.round_number;
    setBuzzerState('active');
    updateBuzzerBadge(null);
    $('player-answer').disabled = false;
    $('player-answer').value = '';
    renderBuzzerOrder([]);
    showRoundGo();
    if (navigator.vibrate) navigator.vibrate(60);
    const buzzer = $('player-buzzer');
    buzzer.classList.add('buzzer-activated');
    buzzer.addEventListener('animationend', function onEnd() {
      buzzer.classList.remove('buzzer-activated');
      buzzer.removeEventListener('animationend', onEnd);
    });
  });

  state.socket.on('buzina:ordem', (data) => {
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

  state.socket.on('placar:atualizado', (data) => {
    const me = data.scores.find(s => s.player_id === state.user.id);
    if (me) $('player-score').textContent = me.score;
    allScores = data.scores;
    updatePlayerRank(data.scores);
  });

  state.socket.on('rodada:proxima', () => {
    state.currentRoundId = null;
    setBuzzerState('disabled');
    updateBuzzerBadge(null);
    $('player-buzzer').classList.remove('first-buzz');
    $('player-answer').disabled = true;
    $('player-answer').value = '';
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

// Input handler para textarea — registra após o DOM estar pronto (script no final do body já garante)
$('player-answer').addEventListener('input', function() {
  if (!state.currentRoundId || this.disabled) return;
  clearTimeout(answerTimeout);
  answerTimeout = setTimeout(() => {
    state.socket.emit('resposta:escrever', {
      round_id: state.currentRoundId,
      player_id: state.user.id,
      text: this.value,
    });
  }, 300);
});

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
    html += '<div class="placar-row' + (isMe ? ' is-me' : '') + '" data-pos="' + pos + '">'
      + '<div class="placar-pos">' + posText + '</div>'
      + '<div class="placar-name">' + escName + '</div>'
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
