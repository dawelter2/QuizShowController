function show(screen) {
  ['screen-login', 'screen-lobby'].forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
  $(screen).classList.remove('hidden');
  if (screen === 'screen-lobby') showLobbyMain();
}

function handleLogin() {
  const name = $('login-name').value.trim();
  if (!name) return toast('Digite seu nome');
  const sessionId = localStorage.getItem('session_id');
  api('/auth', { name, session_id: sessionId || undefined }).then(res => {
    if (res.user) {
      state.user = res.user;
      localStorage.setItem('session_id', res.user.session_id);
      $('lobby-name').textContent = res.user.name;
      show('screen-lobby');
    }
  });
}

function handleLogout() {
  localStorage.removeItem('session_id');
  localStorage.removeItem('last_room_code');
  state.user = null;
  $('login-name').value = '';
  show('screen-login');
  $('login-name').focus();
}

function showJoinRoom() {
  $('lobby-main-actions').classList.add('hidden');
  $('create-form').classList.add('hidden');
  $('join-form').classList.remove('hidden');
  $('join-code').focus();
  refreshActiveRooms();
}

function showCreateRoom() {
  $('lobby-main-actions').classList.add('hidden');
  $('join-form').classList.add('hidden');
  $('create-form').classList.remove('hidden');
  $('room-name').focus();
}

function showLobbyMain() {
  $('join-form').classList.add('hidden');
  $('create-form').classList.add('hidden');
  $('lobby-main-actions').classList.remove('hidden');
}

function refreshActiveRooms() {
  const list = $('active-rooms-list');
  list.innerHTML = '<p style="text-align:center; padding: 1rem; color: #666;">Buscando salas...</p>';

  api('/rooms').then(res => {
    if (!res.rooms || res.rooms.length === 0) {
      list.innerHTML = '<p style="text-align:center; padding: 1rem; color: #666;">Nenhuma sala ativa no momento.</p>';
      return;
    }

    list.innerHTML = '';
    res.rooms.forEach(room => {
      const item = document.createElement('div');
      item.className = 'room-item';
      item.onclick = () => joinRoomByCode(room.code);
      item.innerHTML = `
        <div class="room-info">
          <span class="room-title">${escapeHtml(room.title || 'Sala sem nome')}</span>
          <span class="room-meta">${room.player_count} jogador(es)</span>
        </div>
        <div class="room-code-badge">${room.code}</div>
      `;
      list.appendChild(item);
    });
  }).catch(err => {
    list.innerHTML = '<p style="text-align:center; padding: 1rem; color: #f55;">Erro ao carregar salas.</p>';
  });
}

function handleCreateRoom() {
  const title = $('room-name').value.trim();
  if (!title) return toast('Dê um nome para a sala');

  api('/rooms', { user_id: state.user.id, title }).then(res => {
    if (!res.room) return toast('Erro ao criar sala: ' + (res.error || 'desconhecido'));
    localStorage.setItem('last_room_code', res.room.code);
    location.href = '/apresentador?sala=' + res.room.code;
  }).catch(e => toast('Erro: ' + e.message));
}

function handleJoinRoom() {
  const code = $('join-code').value.trim().toUpperCase();
  if (!code || code.length !== 4) return toast('Código inválido');
  joinRoomByCode(code);
}

function joinRoomByCode(code) {
  api('/rooms/' + code).then(res => {
    if (!res.room) return toast('Sala não encontrada');
    if (res.room.status === 'finished') return toast('Sala encerrada');
    if (res.room.presenter_id === state.user.id) {
      localStorage.setItem('last_room_code', res.room.code);
      location.href = '/apresentador?sala=' + res.room.code;
      return;
    }
    return api('/rooms/' + res.room.id + '/players', { user_id: state.user.id }).then(() => {
      localStorage.setItem('last_room_code', res.room.code);
      location.href = '/jogador?sala=' + res.room.code;
    });
  }).catch(e => toast('Erro: ' + e.message));
}

// ─── Init ─────────────────────────────────────────
const savedSession = localStorage.getItem('session_id');
const savedCode = localStorage.getItem('last_room_code');

if (!savedSession) {
  show('screen-login');
  $('login-name').focus();
} else {
  api('/auth', { session_id: savedSession }).then(res => {
    if (!res.user) {
      localStorage.removeItem('session_id');
      show('screen-login');
      $('login-name').focus();
      return;
    }
    state.user = res.user;
    $('lobby-name').textContent = res.user.name;

    if (!savedCode) {
      show('screen-lobby');
      return;
    }
    // Auto-redirect pra sala antiga, sem mostrar lobby
    api('/rooms/' + savedCode).then(r => {
      if (!r.room || r.room.status === 'finished') {
        localStorage.removeItem('last_room_code');
        show('screen-lobby');
        return;
      }
      const dest = r.room.presenter_id === state.user.id ? '/apresentador' : '/jogador';
      location.href = dest + '?sala=' + r.room.code;
    }).catch(() => {
      localStorage.removeItem('last_room_code');
      show('screen-lobby');
    });
  });
}
