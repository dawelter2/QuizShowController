// Estado global compartilhado entre páginas
const state = { user: null, room: null, socket: null };

function $(id) { return document.getElementById(id); }

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleMenu(id) {
  const el = $(id);
  if (el) el.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
  }
});

function api(path, data) {
  return fetch('/api' + path, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  }).then(r => r.json());
}

function copyRoomCode() {
  const code = state.room?.code;
  if (code) navigator.clipboard.writeText(code).then(() => toast('Código copiado: ' + code));
}

function getRoomCodeFromUrl() {
  return (new URLSearchParams(location.search).get('sala') || '').toUpperCase();
}

// ─── Efeitos UX ───────────────────────────────────
function triggerRipple(buttonEl, event) {
  const rect = buttonEl.getBoundingClientRect();
  const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left;
  const y = (event?.clientY ?? rect.top + rect.height / 2) - rect.top;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  buttonEl.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

function showRoundGo() {
  const el = $('round-go');
  if (!el) return;
  el.classList.remove('show');
  // força reflow pra reiniciar a animação se chamada em sequência
  void el.offsetWidth;
  el.classList.add('show');
  const handler = () => { el.classList.remove('show'); el.removeEventListener('animationend', handler); };
  el.addEventListener('animationend', handler);
}

// Autentica via session_id no localStorage. Sem sessão válida → redireciona pra /.
function setupAuth() {
  const sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    location.href = '/';
    return Promise.reject(new Error('no session'));
  }
  return api('/auth', { session_id: sessionId }).then(res => {
    if (!res.user) {
      localStorage.removeItem('session_id');
      location.href = '/';
      throw new Error('auth failed');
    }
    state.user = res.user;
    return res.user;
  });
}

// Busca a sala pelo code. Inexistente/encerrada → redireciona pra /.
function requireRoom(code) {
  if (!code) {
    location.href = '/';
    return Promise.reject(new Error('no code'));
  }
  return api('/rooms/' + code).then(res => {
    if (!res.room) {
      localStorage.removeItem('last_room_code');
      location.href = '/';
      throw new Error('room not found');
    }
    if (res.room.status === 'finished') {
      localStorage.removeItem('last_room_code');
      toast('Sala encerrada');
      setTimeout(() => location.href = '/', 1200);
      throw new Error('finished');
    }
    state.room = res.room;
    localStorage.setItem('last_room_code', res.room.code);
    return res.room;
  });
}

function handleLeaveRoom() {
  if (state.socket && state.room) {
    state.socket.emit('sala:sair', { room_id: state.room.id, user_id: state.user.id });
    state.socket.disconnect();
  }
  localStorage.removeItem('last_room_code');
  location.href = '/';
}

function handleChangeName() {
  if (state.socket && state.room) {
    state.socket.emit('sala:sair', { room_id: state.room.id, user_id: state.user.id });
    state.socket.disconnect();
  }
  localStorage.removeItem('session_id');
  localStorage.removeItem('last_room_code');
  location.href = '/';
}
