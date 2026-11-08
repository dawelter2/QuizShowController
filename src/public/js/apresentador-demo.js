// Modo de exemplo do painel do apresentador.
// Ativado por /apresentador?demo=1 — não usa login, socket nem sala real.
(function () {
  if (!window.__PRESENTER_DEMO__) return;

  const DEMO_ROUND = 3;
  const baseTs = Date.now();

  const demoPlayers = [
    { user_id: 'p01', name: 'Ana',    role: 'player', score_cache: 12, online: true,  player_code: 'A01', is_duplicate: false },
    { user_id: 'p02', name: 'Bob',    role: 'player', score_cache: 9,  online: true,  player_code: 'B02', is_duplicate: false },
    { user_id: 'p03', name: 'Carol',  role: 'player', score_cache: 7,  online: true,  player_code: 'C03', is_duplicate: false },
    { user_id: 'p04', name: 'David',  role: 'player', score_cache: 5,  online: false, player_code: 'D04', is_duplicate: false },
    { user_id: 'p05', name: 'Eva',    role: 'player', score_cache: 4,  online: true,  player_code: 'E05', is_duplicate: false },
    { user_id: 'p06', name: 'Felipe', role: 'player', score_cache: 3,  online: true,  player_code: 'F06', is_duplicate: false },
    { user_id: 'p07', name: 'Gabi',   role: 'player', score_cache: 2,  online: true,  player_code: 'G07', is_duplicate: false },
    { user_id: 'p08', name: 'Hugo',   role: 'player', score_cache: 1,  online: true,  player_code: 'H08', is_duplicate: false },
    { user_id: 'p09', name: 'Igor',   role: 'player', score_cache: 0,  online: true,  player_code: 'I09', is_duplicate: false },
    { user_id: 'p10', name: 'Julia',  role: 'player', score_cache: -2, online: true,  player_code: 'J10', is_duplicate: false },
  ];

  // Cinco primeiros cliques da rodada, na ordem em que chegaram.
  const demoBuzzes = [
    { player_id: 'p01', player_name: 'Ana',   position: 1, timestamp: new Date(baseTs).toISOString() },
    { player_id: 'p02', player_name: 'Bob',   position: 2, timestamp: new Date(baseTs + 420).toISOString() },
    { player_id: 'p03', player_name: 'Carol', position: 3, timestamp: new Date(baseTs + 860).toISOString() },
    { player_id: 'p04', player_name: 'David', position: 4, timestamp: new Date(baseTs + 1300).toISOString() },
    { player_id: 'p05', player_name: 'Eva',   position: 5, timestamp: new Date(baseTs + 2100).toISOString() },
  ];

  const demoAnswers = {
    p01: { player_name: 'Ana',   text: 'Coringa' },
    p02: { player_name: 'Bob',   text: 'Joker' },
    p03: { player_name: 'Carol', text: 'Batman' },
    p04: { player_name: 'David', text: 'Coringa (2019)' },
    p05: { player_name: 'Eva',   text: 'O Cavaleiro das Trevas' },
  };

  state.previewMode = true;
  state.room = { id: 'demo-room', code: 'DEMO', title: 'CineQuiz — Exemplo' };
  state.user = { id: 'demo-host', name: 'Mestre' };
  state.players = demoPlayers;
  state.currentRoundId = 'demo-round-' + DEMO_ROUND;
  state.buzzerOrder = demoBuzzes;
  state.answers = demoAnswers;
  state.autoNextRound = false;
  state.judgedPlayers = new Set();
  state.prevScoresByPid = {};
  demoPlayers.forEach(p => { state.prevScoresByPid[p.user_id] = p.score_cache; });

  $('pres-code').textContent = 'DEMO';
  $('pres-title').textContent = 'CineQuiz — Exemplo';
  $('pres-round-room-title').textContent = 'CineQuiz — Exemplo';
  $('pres-round-num').textContent = String(DEMO_ROUND);
  $('btn-round-control').textContent = '⏭ Próxima Rodada';
  $('btn-round-control').className = 'btn btn-warning';
  document.title = 'CineQuiz — Exemplo — Apresentador';

  const nav = document.querySelector('.nav-bar');
  if (nav && !nav.querySelector('.preview-badge')) {
    const badge = document.createElement('span');
    badge.className = 'preview-badge';
    badge.textContent = 'PREVIEW · 10 jogadores · 5 cliques';
    nav.insertBefore(badge, nav.children[1] || null);
  }

  // Abre o painel de vídeo com um placeholder para mostrar o layout real.
  state.showVideo = true;
  $('video-panel').classList.remove('hidden');
  $('btn-video-toggle').classList.add('active');
  document.querySelector('.content').classList.add('layout-video');
  $('video-input-row').classList.add('hidden');
  const videoContainer = $('video-container');
  videoContainer.classList.remove('hidden');
  videoContainer.innerHTML = `
    <div class="video-demo-placeholder">
      🎬 FRAME DO VÍDEO
      <span>YouTube · exemplo</span>
    </div>
  `;

  function startDemoRound() {
    state.currentRoundId = 'demo-round-' + Date.now();
    state.buzzerOrder = [];
    state.answers = {};
    state.judgedPlayers.clear();
    const current = parseInt($('pres-round-num').textContent, 10) || 1;
    $('pres-round-num').textContent = String(current + 1);
    updateRoundButton(true);
    renderBuzzerOrder([]);
    renderPresenterPlayers(state.players);
    showRoundGo();
  }

  // Substitui os handlers reais no modo de exemplo.
  window.changeScore = function (playerId, delta) {
    if (!state.currentRoundId) return toast('Inicie uma rodada primeiro');

    if (state.buzzerOrder.some(o => o.player_id === playerId)) {
      state.judgedPlayers.add(playerId);
      renderBuzzerOrderList();
    }

    const player = state.players?.find(p => p.user_id === playerId);
    if (player) {
      player.score_cache += delta;
      state.prevScoresByPid[playerId] = player.score_cache;
      renderPresenterPlayers(state.players);
    }

    if (state.autoNextRound) startDemoRound();
  };

  window.handleRemovePlayer = function (userId) {
    const player = state.players?.find(p => p.user_id === userId);
    if (!player) return;
    if (!confirm(`Remover ${player.name} do exemplo?`)) return;

    state.players = state.players.filter(p => p.user_id !== userId);
    state.buzzerOrder = state.buzzerOrder.filter(o => o.player_id !== userId);
    state.judgedPlayers.delete(userId);
    renderPresenterPlayers(state.players);
    renderBuzzerOrderList();
    toast(`${player.name} removido do exemplo`);
  };

  window.handleStartRound = function () {
    startDemoRound();
  };

  window.handleNextRound = function () {
    startDemoRound();
  };

  window.handleResetGame = function () {
    if (!confirm('Reiniciar o exemplo?\\n\\nOs pontos voltam a zero e a lista de cliques é limpa.')) return;
    state.players.forEach(p => { p.score_cache = 0; });
    state.prevScoresByPid = {};
    state.players.forEach(p => { state.prevScoresByPid[p.user_id] = 0; });
    state.buzzerOrder = [];
    state.answers = {};
    state.judgedPlayers.clear();
    state.currentRoundId = 'demo-round-1';
    $('pres-round-num').textContent = '1';
    updateRoundButton(true);
    renderPresenterPlayers(state.players);
    renderBuzzerOrder([]);
    toggleMenu('pres-menu');
  };

  renderPresenterPlayers(state.players);
  renderBuzzerOrder(state.buzzerOrder);
  renderAnswers();
})();
