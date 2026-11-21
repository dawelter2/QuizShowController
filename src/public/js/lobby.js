function show(screen) {
  ['screen-login', 'screen-lobby'].forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
  $(screen).classList.remove('hidden');
  if (screen === 'screen-lobby') showLobbyMain();
}

// Fallback local usado só se GET /api/game-types falhar. A fonte de verdade é
// src/store/game-types.ts; mantenha em sincronia ao adicionar tipos de jogo.
const FALLBACK_GAME_TYPES = [
  {
    id: 'buzzer-order',
    name: 'Ordem das Buzinas',
    description: 'Quiz em vídeo: os jogadores apertam a buzina e o apresentador pontua na ordem dos cliques.',
    fields: [
      { key: 'quiz_url', label: 'URL do quiz no YouTube', type: 'url', format: 'youtube', placeholder: 'https://www.youtube.com/watch?v=...', default: '', help: 'Opcional. Se preencher, a URL já vem carregada no painel do apresentador.' },
      { key: 'total_rounds', label: 'Número de rodadas', type: 'number', min: 0, max: 200, step: 1, default: 0, help: '0 = sem limite. Com limite, a partida termina após a última rodada.' },
      { key: 'points_exact', label: 'Pontuação certeira', type: 'number', min: 1, max: 100, step: 1, default: 3, help: 'Pontos para quem acerta na mosca.' },
      { key: 'points_near', label: 'Pontuação quase', type: 'number', min: 0, max: 100, step: 1, default: 1, help: 'Pontos para quem chega perto.' },
      { key: 'penalty_type', label: 'Tipo de punição', type: 'select', default: 'rounds', options: [{ value: 'rounds', label: 'Rodadas de punição' }, { value: 'points', label: 'Subtrair pontos' }], help: 'O que acontece quando o apresentador clica em "Errou".' },
      { key: 'penalty_rounds', label: 'Rodadas de punição', type: 'number', min: 1, max: 50, step: 1, default: 3, show_when: { key: 'penalty_type', equals: 'rounds' }, help: 'Quantas rodadas o jogador fica sem poder buzinar.' },
      { key: 'penalty_points', label: 'Pontos a subtrair', type: 'number', min: 0, max: 100, step: 1, default: 3, show_when: { key: 'penalty_type', equals: 'points' }, help: 'Quantos pontos são retirados do placar do jogador.' },
    ],
  },
  {
    id: 'answers',
    name: 'Respostas',
    description: 'Quiz em vídeo com alternativas: cada jogador escolhe uma opção e o apresentador revela e corrige.',
    fields: [
      { key: 'video_url', label: 'URL do vídeo no YouTube', type: 'url', format: 'youtube', placeholder: 'https://www.youtube.com/watch?v=...', default: '', help: 'Opcional. Se preencher, o vídeo já vem carregado no painel do apresentador.' },
      { key: 'option_count', label: 'Quantidade de opções', type: 'number', min: 1, max: 6, step: 1, default: 4, help: 'Quantas alternativas aparecem na tela do jogador (1 a 6).' },
      { key: 'option_style', label: 'Tipo de opções', type: 'select', default: 'alpha', options: [{ value: 'alpha', label: 'Alfabético (A, B, C...)' }, { value: 'numeric', label: 'Numérico (1, 2, 3...)' }], help: 'Rótulo usado nos botões de resposta.' },
      { key: 'points_first', label: 'Pontos para quem acertar primeiro', type: 'number', min: 1, max: 100, step: 1, default: 3, help: 'Pontos do jogador que respondeu corretamente antes dos demais.' },
      { key: 'points_later', label: 'Pontos para quem acertar depois', type: 'number', min: 0, max: 100, step: 1, default: 1, help: 'Pontos dos demais jogadores que também acertaram.' },
    ],
  },
];

function loadGameTypes() {
  return api('/game-types').then(res => {
    const types = res && res.game_types;
    state.roomTypes = Array.isArray(types) && types.length > 0 ? types : FALLBACK_GAME_TYPES;
    return state.roomTypes;
  }).catch(() => {
    state.roomTypes = FALLBACK_GAME_TYPES;
    return state.roomTypes;
  });
}

function getGameTypes() {
  return (state.roomTypes && state.roomTypes.length) ? state.roomTypes : FALLBACK_GAME_TYPES;
}

function selectedGameType() {
  const select = $('room-type');
  return getGameTypes().find(type => type.id === (select ? select.value : ''));
}

function fillRoomTypeSelect() {
  const select = $('room-type');
  if (!select) return;

  const types = getGameTypes();
  select.innerHTML = types.map(type =>
    `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`
  ).join('');
  renderRoomConfigFields();
}

// Desenha os campos de configuração do tipo escolhido a partir da metadata
// do servidor (url/number/select + show_when para campos condicionais).
function renderRoomConfigFields() {
  const container = $('room-config-fields');
  const description = $('room-type-description');
  const type = selectedGameType();
  if (!container) return;

  if (!type) {
    container.innerHTML = '';
    if (description) description.textContent = '';
    return;
  }

  if (description) description.textContent = type.description || '';
  container.innerHTML = type.fields.map(field => {
    const id = 'cfg-' + field.key;
    let control;
    if (field.type === 'select') {
      control = `<select id="${id}" data-config-key="${field.key}">${field.options.map(option =>
        `<option value="${escapeHtml(option.value)}"${option.value === field.default ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
      ).join('')}</select>`;
    } else if (field.type === 'number') {
      control = `<input id="${id}" data-config-key="${field.key}" type="number" step="${field.step || 1}" min="${field.min}" max="${field.max}" value="${field.default}">`;
    } else {
      control = `<input id="${id}" data-config-key="${field.key}" type="url" value="${escapeHtml(field.default)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}>`;
    }

    return `<div class="config-field" data-field-key="${field.key}">
      <label for="${id}">${escapeHtml(field.label)}</label>
      ${control}
      ${field.help ? `<span class="field-help">${escapeHtml(field.help)}</span>` : ''}
    </div>`;
  }).join('');

  container.querySelectorAll('[data-config-key]').forEach(el => {
    el.addEventListener('change', updateConditionalFields);
  });
  updateConditionalFields();
}

function updateConditionalFields() {
  const container = $('room-config-fields');
  const type = selectedGameType();
  if (!container || !type) return;

  type.fields.forEach(field => {
    if (!field.show_when) return;
    const wrapper = container.querySelector(`.config-field[data-field-key="${field.key}"]`);
    const source = container.querySelector(`[data-config-key="${field.show_when.key}"]`);
    if (!wrapper) return;
    const visible = !!source && String(source.value) === String(field.show_when.equals);
    wrapper.classList.toggle('hidden', !visible);
  });
}

function collectRoomConfig() {
  const config = {};
  // Ignora campos condicionais ocultos: o servidor aplica o default deles e
  // assim um valor inválido digitado antes de trocar o tipo não bloqueia o envio.
  document.querySelectorAll('#room-config-fields .config-field:not(.hidden) [data-config-key]').forEach(el => {
    let value;
    if (el.type === 'number') {
      value = el.value === '' ? undefined : Number(el.value);
    } else {
      value = el.value.trim();
    }
    if (value !== undefined) config[el.dataset.configKey] = value;
  });
  return config;
}

function validateRoomConfigFields() {
  // Só valida campos visíveis: os condicionais ocultos mantêm valores antigos.
  const wrappers = document.querySelectorAll('#room-config-fields .config-field:not(.hidden)');
  for (const wrapper of wrappers) {
    for (const input of wrapper.querySelectorAll('[data-config-key]')) {
      if (input.checkValidity()) continue;
      input.reportValidity();
      return false;
    }
  }
  return true;
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

  const ready = state.roomTypes ? Promise.resolve() : loadGameTypes();
  ready.then(() => {
    if (!$('room-type').options.length) fillRoomTypeSelect();
    $('room-name').focus();
  });
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
  if (!$('room-type').value) return toast('Escolha o tipo de jogo');
  if (!validateRoomConfigFields()) return;

  const type = $('room-type').value;
  const config = collectRoomConfig();

  api('/rooms', { user_id: state.user.id, title, type, config }).then(res => {
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
    return joinRoomEntry(res.room, false);
  }).catch(e => toast('Erro: ' + e.message));
}

// Entra na sala tratando nome já em uso (oferece trocar o nome e tenta de novo).
function joinRoomEntry(room, retried) {
  return api('/rooms/' + room.id + '/players', { user_id: state.user.id }).then(res => {
    if (res && res.ok) {
      localStorage.setItem('last_room_code', room.code);
      location.href = '/jogador?sala=' + room.code;
      return;
    }

    if (res && res.code === 'NAME_TAKEN' && !retried) {
      const typed = prompt(`O nome "${state.user.name}" já está em uso nesta sala.\nDigite outro nome:`);
      if (typed === null) return;
      const name = typed.trim().replace(/\s+/g, ' ');
      if (!name) return toast('Digite um nome');

      return api('/auth', { session_id: state.user.session_id, name }, 'PATCH').then(renamed => {
        if (!renamed || !renamed.user) {
          return toast((renamed && renamed.error) || 'Não foi possível trocar o nome');
        }
        state.user = renamed.user;
        if ($('lobby-name')) $('lobby-name').textContent = state.user.name;
        return joinRoomEntry(room, true);
      });
    }

    if (res && res.code === 'NAME_TAKEN') {
      return toast('Esse nome ainda está em uso. Saia e entre com outro nome.');
    }

    toast((res && res.error) || 'Não foi possível entrar na sala');
  });
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
