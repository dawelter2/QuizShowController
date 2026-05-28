state.currentRoundId = null;
let answerTimeout = null;

function setBuzzerState(mode) {
  const buzzer = $('player-buzzer');
  buzzer.disabled = mode !== 'active';
  const wasFirst = buzzer.classList.contains('first-buzz');
  buzzer.className = 'buzzer-btn buzzer-' + mode;
  if (wasFirst) buzzer.classList.add('first-buzz');
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
    const order = round.buzzer_order || [];
    const myBuzz = order.find(o => o.player_id === state.user.id);
    setBuzzerState(myBuzz ? 'pressed' : 'active');
    buzzer.classList.toggle('first-buzz', order[0]?.player_id === state.user.id);
    answer.disabled = false;
    const myAnswer = (round.answers || []).find(a => a.player_id === state.user.id);
    answer.value = myAnswer?.text || '';
    renderBuzzerOrder(order);
  } else {
    state.currentRoundId = null;
    setBuzzerState('disabled');
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

function connectPlayerSocket() {
  state.socket = io('/', { query: { room_id: state.room.id, user_id: state.user.id } });

  state.socket.on('connect', () => {
    state.socket.emit('sala:entrar', { room_id: state.room.id, user_id: state.user.id });
  });

  state.socket.on('connect_error', (err) => toast('Erro de conexão: ' + err.message));

  state.socket.on('sala:status', (data) => {
    state.room = { ...state.room, ...data.room };
    $('player-room-title').textContent = state.room.title || 'Quiz';
    const me = data.scores?.find(s => s.player_id === state.user.id);
    if (me) $('player-score').textContent = me.score;
    applyRoundSnapshot(data.current_round);
  });

  state.socket.on('rodada:iniciada', (data) => {
    state.currentRoundId = data.round_id;
    setBuzzerState('active');
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
    const myPos = data.order.find(o => o.player_id === state.user.id);
    if (myPos) setBuzzerState('pressed');
    const wasAlreadyFirst = $('player-buzzer').classList.contains('first-buzz');
    $('player-buzzer').classList.toggle('first-buzz', data.order[0]?.player_id === state.user.id);
    if (!wasAlreadyFirst && data.order[0]?.player_id === state.user.id) {
      toast('🏆 PRIMEIRO!');
    }
    renderBuzzerOrder(data.order);
  });

  state.socket.on('placar:atualizado', (data) => {
    const me = data.scores.find(s => s.player_id === state.user.id);
    if (me) $('player-score').textContent = me.score;
  });

  state.socket.on('rodada:proxima', () => {
    state.currentRoundId = null;
    setBuzzerState('disabled');
    $('player-buzzer').classList.remove('first-buzz');
    $('player-answer').disabled = true;
    $('player-answer').value = '';
    renderBuzzerOrder([]);
  });

  state.socket.on('erro', (data) => toast(data.message));
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

// ─── Init ─────────────────────────────────────────
setupAuth()
  .then(() => requireRoom(getRoomCodeFromUrl()))
  .then(room => {
    if (room.presenter_id === state.user.id) {
      location.href = '/apresentador?sala=' + room.code;
      return;
    }
    $('player-name').textContent = state.user.name;
    $('player-room-title').textContent = room.title || 'Quiz';
    return api('/rooms/' + room.id + '/players', { user_id: state.user.id })
      .then(() => connectPlayerSocket());
  })
  .catch(() => { /* redirect já feito */ });
