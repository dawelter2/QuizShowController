# API — Endpoints e Eventos

Duas camadas de comunicação:

| Tipo       | Quando usar                    | Exemplos                          |
|-----------|--------------------------------|-----------------------------------|
| **HTTP**   | Ações pontuais (criar, listar) | Login, criar sala, listar jogadores |
| **WebSocket** | Ações em tempo real (jogo)  | Buzina, resposta, pontuação, começar rodada |

---

## 1. Endpoints HTTP (REST)

### Autenticação

```
POST /api/auth
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| name  | string | Nome do usuário |

**Resposta:**
```json
{
  "user": { "id": "uuid", "name": "Mestre", "session_id": "abc123" }
}
```

> Cria um `user` se não existir, ou retorna o existente se o `session_id` for reenviado.
> O `session_id` deve ser armazenado no frontend (localStorage) para reconexão.

#### `PATCH /api/auth`

Renomeia o usuário sem criar outra identidade (mesmo `user_id`, mesma sessão).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| session_id | string | Sessão atual do usuário |
| name | string | Novo nome (1–50 caracteres) |

**Resposta:** `{ "user": { "id": "uuid", "name": "Novo Nome", "session_id": "..." } }`

> Usado pelo lobby quando o nome escolhido já está em uso na sala. A validação
> de unicidade por sala acontece na entrada (`POST /rooms/:id/players`).

---

### Salas

```
POST /api/rooms         → Criar sala
GET  /api/rooms/:code   → Buscar sala pelo código
PUT  /api/rooms/:id     → Atualizar sala (título, notas)
DELETE /api/rooms/:id   → Encerrar sala
```

#### `POST /api/rooms`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| user_id | string | ID do usuário (vira apresentador) |
| title | string | Nome da sessão (opcional) |
| notes | string | Link do vídeo, observações (opcional) |

**Resposta:**
```json
{
  "room": {
    "id": "uuid",
    "code": "X7K9",
    "title": "CineQuiz 12/05",
    "notes": "https://youtube.com/playlist?list=...",
    "status": "waiting",
    "presenter": { "id": "uuid", "name": "Mestre" }
  }
}
```

#### `GET /api/rooms/:code`

Busca pelo código de 4 letras. Usado para validar se a sala existe antes de entrar.

**Resposta:**
```json
{
  "room": {
    "id": "uuid",
    "code": "X7K9",
    "title": "CineQuiz 12/05",
    "status": "waiting",
    "player_count": 3
  }
}
```

#### `PUT /api/rooms/:id`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| title | string | Novo título (opcional) |
| notes | string | Novas observações (opcional) |

**Resposta:** `{ "room": { ... } }`

#### `DELETE /api/rooms/:id`

Encerra a sala. Só o apresentador pode fazer.

**Resposta:** `{ "ok": true }`

---

### Jogadores

```
GET    /api/rooms/:id/players          → Listar jogadores na sala
POST   /api/rooms/:id/players          → Entrar na sala (valida nome único)
DELETE /api/rooms/:id/players/:userId  → Remover jogador (somente apresentador)
```

#### `POST /api/rooms/:id/players`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| user_id | string | Usuário que está entrando |

Regras:
- mesmo `user_id` já na sala → reativa a entrada;
- nome igual a um jogador **offline** → adota a identidade antiga (`adopted: true`), preservando pontos;
- nome igual a um jogador **online** ou recém-entrado → `409 { "code": "NAME_TAKEN" }`;
- usuário removido pelo apresentador → `403 { "code": "KICKED" }`.

**Resposta:**
```json
{ "ok": true, "user": { "id": "uuid", "name": "Ana" }, "adopted": false }
```

#### `GET /api/rooms/:id/players`

**Resposta:**
```json
{
  "players": [
    {
      "user_id": "uuid",
      "name": "Ana",
      "role": "player",
      "score_cache": 10,
      "online": true,
      "is_duplicate": false,
      "player_code": "A1B2"
    }
  ]
}
```

> `player_code` é apenas exibição (4 últimos hex do UUID). `online` vem dos sockets conectados.

#### `DELETE /api/rooms/:id/players/:userId`

Apresentador pode remover um jogador da sala.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| presenter_id | string | Deve ser o `presenter_id` da sala |

**Resposta:** `{ "ok": true }` — ou `403` se quem pediu não for o apresentador.

> A UI usa o evento WebSocket `jogador:remover` para que a remoção seja
> refletida em tempo real nos outros clientes. A remoção mantém a sessão
> bloqueada até `jogo:resetar` ou o encerramento da sala.

---

### Rodadas (consulta)

```
GET /api/rooms/:id/rounds       → Histórico de rodadas
GET /api/rooms/:id/rounds/:roundId → Detalhes de uma rodada
```

#### `GET /api/rooms/:id/rounds/:roundId`

**Resposta:**
```json
{
  "round": {
    "round_number": 3,
    "media_url": "https://youtube.com/...",
    "correct_answer": "Titanic",
    "status": "done",
    "buzzers": [
      { "player": "Ana", "position": 1, "timestamp": "..." },
      { "player": "Bob", "position": 2, "timestamp": "..." }
    ],
    "answers": [
      { "player": "Ana", "text": "Titanic", "judgment": "na_mosca", "score_delta": 3 },
      { "player": "Bob", "text": "O Barco", "judgment": "errado", "score_delta": -2 }
    ]
  }
}
```

---

## 2. Eventos WebSocket (tempo real)

Conexão: `ws://localhost:7000/ws?sala_id=UUID&user_id=UUID`

### Eventos do Cliente para o Servidor

#### `sala:entrar`

Jogador entra na sala (após já ter o código via HTTP).

```json
{
  "event": "sala:entrar",
  "data": { "room_id": "uuid", "user_id": "uuid" }
}
```

**Servidor responde:** `sala:status` com estado completo.
Ack: `{ "ok": true, "user": { ... }, "adopted": false }`.
Erros: `NAME_TAKEN` (409 no HTTP equivalente), `KICKED`, `ROOM_NOT_FOUND`, `USER_NOT_FOUND`.
Se a identidade for adotada no socket, o servidor também emite `sessao:adotada`.

---

#### `rodada:iniciar`

Apresentador libera buzinas e inicia nova rodada.

```json
{
  "event": "rodada:iniciar",
  "data": {
    "room_id": "uuid",
    "media_url": "https://youtube.com/...",
    "correct_answer": "Coringa"
  }
}
```

**Servidor emite para todos:** `rodada:iniciada`

```json
{
  "event": "rodada:iniciada",
  "data": {
    "round_id": "uuid",
    "round_number": 1,
    "media_url": "https://youtube.com/..."
  }
}
```

---

#### `buzina:apertar`

Jogador apertou a buzina.

```json
{
  "event": "buzina:apertar",
  "data": { "round_id": "uuid", "player_id": "uuid" }
}
```

**Servidor valida:**
- Jogador já apertou nesta rodada? → **ignora** (não emite nada)
- Primeira vez → registra posição e emite `buzina:ordem`

**Servidor emite para todos:** `buzina:ordem`

```json
{
  "event": "buzina:ordem",
  "data": {
    "round_id": "uuid",
    "order": [
      { "player_id": "uuid", "player_name": "Ana", "position": 1 },
      { "player_id": "uuid", "player_name": "Bob", "position": 2 }
    ]
  }
}
```

---

#### `resposta:escrever`

Jogador digitou/modificou a resposta (em tempo real enquanto digita, ou ao submeter).

```json
{
  "event": "resposta:escrever",
  "data": {
    "round_id": "uuid",
    "player_id": "uuid",
    "text": "Coringa"
  }
}
```

**Servidor emite para o apresentador:** `resposta:atualizada`

```json
{
  "event": "resposta:atualizada",
  "data": {
    "round_id": "uuid",
    "player_id": "uuid",
    "player_name": "Ana",
    "text": "Coringa"
  }
}
```

> Apenas o **apresentador** recebe as respostas em tempo real. Os jogadores não veem a resposta uns dos outros.

---

#### `pontos:alterar`

Apresentador altera pontos de um jogador.

```json
{
  "event": "pontos:alterar",
  "data": {
    "round_id": "uuid",
    "player_id": "uuid",
    "score_delta": 3,
    "judgment": "na_mosca"
  }
}
```

**Servidor:**
1. Atualiza `answers` com `judgment` e `score_delta`
2. Atualiza `score_cache` do jogador na sala
3. Emite `placar:atualizado` para **todos**

```json
{
  "event": "placar:atualizado",
  "data": {
    "room_id": "uuid",
    "scores": [
      { "player_id": "uuid", "player_name": "Ana", "score": 10 },
      { "player_id": "uuid", "player_name": "Bob", "score": 5 },
      { "player_id": "uuid", "player_name": "Carol", "score": 0 }
    ]
  }
}
```

---

#### `rodada:proxima`

Apresentador avança para a próxima rodada.

```json
{
  "event": "rodada:proxima",
  "data": { "room_id": "uuid", "round_id": "uuid" }
}
```

**Servidor:**
1. Marca rodada atual como `done`
2. Cria nova rodada como `waiting`
3. Emite para **todos**: `rodada:proxima`

```json
{
  "event": "rodada:proxima",
  "data": { "new_round_id": "uuid", "round_number": 2 }
}
```

---

#### `sala:sair`

Jogador ou apresentador sai da sala.

```json
{
  "event": "sala:sair",
  "data": { "room_id": "uuid", "user_id": "uuid" }
}
```

**Servidor emite para todos:** `sala:jogadores` (lista atualizada)
**Ack:** `{ "ok": true }`

---

#### `jogador:remover`

Apresentador remove um jogador da sala (tempo real).

```json
{
  "event": "jogador:remover",
  "data": { "room_id": "uuid", "user_id": "uuid" }
}
```

**Servidor:**
1. Valida que o socket pertence ao `presenter_id` da sala.
2. Marca o jogador como removido (`left_at` + `kicked_at`), tira do placar e
   apaga as respostas dele nas rodadas da sala.
3. Emite `sala:removido` para os sockets do removido e os retira da sala.
4. Emite `sala:status` para todos (painel, placar e OBS).
5. **Ack:** `{ "ok": true }` ou `{ "ok": false, "error": "..." }`.

---

#### `usuario:renomear`

Renomeia o usuário sem trocar de identidade/sessão.

```json
{
  "event": "usuario:renomear",
  "data": { "name": "Novo Nome" }
}
```

**Servidor:** valida tamanho e conflito com outro jogador ativo da sala; atualiza
`users` e o nome em todas as salas do usuário; reemite `sala:status` +
`sala:jogadores`.

**Ack:** `{ "ok": true, "user": { ... } }` ou `{ "ok": false, "code": "NAME_TAKEN", "error": "..." }`.

---

### Eventos do Servidor para o Cliente

| Evento | Para quem | Quando |
|--------|-----------|--------|
| `sala:status` | Todos (ao conectar) | Estado completo da sala |
| `sala:jogadores` | Todos | Alguém entrou, saiu, ficou online/offline ou foi removido |
| `sala:removido` | Jogador removido | Apresentador removeu este jogador |
| `sessao:adotada` | Jogador | Sessão nova reutilizou a identidade de uma entrada offline |
| `rodada:iniciada` | Todos | Apresentador iniciou rodada |
| `rodada:proxima` | Todos | Apresentador avançou rodada |
| `buzina:ordem` | Todos | Alguém apertou a buzina |
| `resposta:atualizada` | Apresentador | Jogador digitou resposta |
| `placar:atualizado` | Todos | Apresentador alterou pontos |
| `erro` | Quem enviou | Validação falhou |

#### `sala:status`

```json
{
  "event": "sala:status",
  "data": {
    "room": {
      "id": "uuid",
      "code": "X7K9",
      "title": "CineQuiz 12/05",
      "status": "playing",
      "notes": "https://..."
    },
    "players": [
      {
        "user_id": "uuid",
        "name": "Ana",
        "role": "player",
        "score_cache": 10,
        "online": true,
        "is_duplicate": false,
        "player_code": "A1B2"
      },
      {
        "user_id": "uuid",
        "name": "Bob",
        "role": "player",
        "score_cache": 5,
        "online": false,
        "is_duplicate": false,
        "player_code": "C3D4"
      }
    ],
    "current_round": {
      "id": "uuid",
      "round_number": 3,
      "status": "active",
      "media_url": "https://...",
      "buzzer_order": [
        { "player_id": "uuid", "player_name": "Ana", "position": 1 }
      ]
    }
  }
}
```

#### `erro`

```json
{
  "event": "erro",
  "data": {
    "code": "BUZZER_DUPLICADO",
    "message": "Você já apertou a buzina nesta rodada"
  }
}
```

---

## 3. Resumo: HTTP vs WebSocket

| Ação                          | HTTP | WebSocket |
|-------------------------------|------|-----------|
| Criar conta / login           | ✅   |           |
| Criar sala                    | ✅   |           |
| Buscar sala por código        | ✅   |           |
| Editar sala (título, notas)   | ✅   |           |
| Listar jogadores              | ✅   |           |
| Remover jogador               | ✅   | ✅        |
| Renomear (sem trocar sessão)  | ✅   | ✅        |
| Histórico de rodadas          | ✅   |           |
| Entrar na sala (conectar)     |      | ✅        |
| Iniciar rodada                |      | ✅        |
| Apertar buzina                |      | ✅        |
| Escrever resposta             |      | ✅        |
| Alterar pontos                |      | ✅        |
| Próxima rodada                |      | ✅        |
| Sair da sala                  |      | ✅        |
| Receber status atualizado     |      | ✅        |
| Receber placar em tempo real  |      | ✅        |
