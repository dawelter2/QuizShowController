# Modelagem de Dados

## Visão Geral

Duas camadas de dados:
1. **Jogo** — entidades necessárias para o funcionamento em tempo real
2. **Métricas** — dados históricos para análise futura (desempenho, engajamento)

---

## 1. Modelo do Jogo (em memória + persistência leve)

### Entidades e Relacionamentos

```
users ──< room_players >── rooms
  │                           │
  │                           │
  └──< answers                │
  └──< buzzer_events          │
                               │
                        rounds <── room_players
```

### Diagrama DER

```
┌─────────────────────────────────────────────────────┐
│                    ROOMS                             │
│ id (UUID)          ←──────────┐                     │
│ code (VARCHAR 4)              │                     │
│ presenter_id (UUID) ──┐       │                     │
│ title (VARCHAR)       │       │                     │
│ status (ENUM)         │       │                     │
│ created_at            │       │                     │
│ ended_at              │       │                     │
└───────────────────────┼───────┼─────────────────────┘
                        │       │
  ┌─────────────────────┘       │
  │                             │
  ▼                             ▼
┌─────────────────────┐  ┌───────────────────────────┐
│      USERS          │  │      ROOM_PLAYERS          │
│ id (UUID)           │  │ room_id (FK)               │
│ name (VARCHAR)      │  │ user_id (FK)               │
│ session_id (VARCHAR)│  │ role (ENUM: presenter/player)│
│ created_at          │  │ joined_at                  │
│ last_seen           │  │ left_at (nullable)         │
└─────────┬───────────┘  │ score_cache (INT, default 0)│
          │              └───────────────────────────┘
          │
          │
  ┌───────┴───────────────────────────────────────────┐
  │                    ROUNDS                          │
  │ id (UUID)          ←────────── room_id (FK)        │
  │ round_number (INT)                                 │
  │ media_url (VARCHAR) ← link YouTube/img             │
  │ correct_answer (VARCHAR) ← resposta do vídeo       │
  │ status (ENUM: waiting, active, done)               │
  │ started_at                                         │
  │ ended_at                                           │
  └───────┬───────────────────────────────────────────┘
          │
          │
  ┌───────┴──────────────────┐  ┌──────────────────────┐
  │     BUZZER_EVENTS        │  │      ANSWERS          │
  │ id (UUID)                │  │ id (UUID)             │
  │ round_id (FK)            │  │ round_id (FK)         │
  │ player_id (FK)           │  │ player_id (FK)        │
  │ position (INT) ← ordem   │  │ text (TEXT)           │
  │ timestamp (TIMESTAMP)    │  │ submitted_at          │
  └──────────────────────────┘  │ judgment (ENUM:       │
                                │   na_mosca,           │
                                │   raspando,           │
                                │   errado,             │
                                │   none)               │
                                │ score_delta (INT)     │
                                │   ex: +3, +1, 0       │
                                │ judged_by (FK→users)  │
                                │ judged_at             │
                                └──────────────────────┘
```

---

## 2. Dicionário de Dados

### `users`

| Campo        | Tipo        | Descrição                              |
|-------------|-------------|----------------------------------------|
| id           | UUID        | Chave primária                        |
| name         | VARCHAR(50) | Nome exibido (não único)              |
| session_id   | VARCHAR(64) | ID de sessão para reconexão           |
| created_at   | TIMESTAMP   | Primeiro acesso                       |
| last_seen    | TIMESTAMP   | Última atividade                      |

### `rooms`

| Campo        | Tipo         | Descrição                              |
|-------------|--------------|----------------------------------------|
| id           | UUID         | Chave primária                        |
| code         | VARCHAR(4)   | Código único para entrar na sala      |
| presenter_id | UUID (FK)    | Quem criou a sala (dono)              |
| title        | VARCHAR(100) | Nome da sessão (ex: "CineQuiz 12/05") |
| notes        | TEXT         | Observações da sala (regras, etc.)    |
| type         | ENUM         | Tipo de tela de jogo (`buzzer-order` = Ordem das Buzinas, `answers` = Respostas) |
| config       | JSON         | Opções da sala. `buzzer-order`: `quiz_url`, `total_rounds`, `points_exact`, `points_near`, `penalty_type`, `penalty_rounds`, `penalty_points`. `answers`: `video_url`, `option_count`, `option_style`, `points_first`, `points_later` |
| status       | ENUM         | `waiting | playing | finished`        |
| created_at   | TIMESTAMP    |                                        |
| ended_at     | TIMESTAMP    | Quando a sala foi encerrada           |

> `config` é normalizado pelo servidor na criação (`src/store/game-types.ts`).
> Defaults de "Ordem das Buzinas": `total_rounds: 0` (sem limite),
> `points_exact: 3`, `points_near: 1`, `penalty_type: 'rounds'`,
> `penalty_rounds: 3`, `penalty_points: 3` e `quiz_url: ''`.
> Defaults de "Respostas": `video_url: ''`, `option_count: 4`,
> `option_style: 'alpha'`, `points_first: 3`, `points_later: 1`.

### `room_players`

| Campo        | Tipo        | Descrição                              |
|-------------|-------------|----------------------------------------|
| room_id      | UUID (FK)   | Sala                                   |
| user_id      | UUID (FK)   | Jogador/presenter                     |
| role         | ENUM        | `presenter | player`                  |
| joined_at    | TIMESTAMP   |                                        |
| left_at      | TIMESTAMP   | Null se ainda está na sala (saída voluntária ou remoção) |
| kicked_at    | TIMESTAMP   | Null se não foi removido pelo apresentador |
| claimed_at   | TIMESTAMP   | Última entrada/adoção; reserva o nome por 10 s antes do socket conectar |
| last_online_at | TIMESTAMP | Última vez que teve socket ativo (null = nunca conectou) |
| score_cache  | INT         | Score total (desnormalizado)          |
| penalty_start_round | INT  | Primeira rodada sem buzinar (0 = sem punição; só quando `penalty_type = rounds`) |
| penalty_until_round | INT  | Última rodada sem buzinar (0 = sem punição; só quando `penalty_type = rounds`) |

> `online` não é persistido: é derivado dos sockets conectados (`presenceMap`).
> O estado é mantido em memória; `data/quiz.db` não é usado por esta versão.

> `(room_id, user_id)` é chave única.

### `rounds`

| Campo          | Tipo        | Descrição                              |
|---------------|-------------|----------------------------------------|
| id             | UUID        | Chave primária                        |
| room_id        | UUID (FK)   | Sala                                   |
| round_number   | INT         | Sequencial (1, 2, 3...)               |
| media_url      | VARCHAR(500)| Link YouTube/img da pergunta          |
| correct_answer | VARCHAR(200)| Resposta esperada (pra ajudar o apresentador)|
| status         | ENUM        | `waiting | active | done`             |
| started_at     | TIMESTAMP   | Quando o apresentador liberou buzinas |
| ended_at       | TIMESTAMP   | Quando o apresentador finalizou       |
| answers_revealed | BOOLEAN   | Tipo Respostas: alternativas já visíveis ao host |
| answers_graded | BOOLEAN     | Tipo Respostas: rodada já corrigida   |
| correct_option | INT         | Tipo Respostas: alternativa correta (1..6) |
| eligible_player_ids | JSON   | Snapshot dos jogadores que podem responder nesta rodada |

### `buzzer_events`

| Campo      | Tipo        | Descrição                              |
|-----------|-------------|----------------------------------------|
| id         | UUID        | Chave primária                        |
| round_id   | UUID (FK)   | Rodada                                 |
| player_id  | UUID (FK)   | Jogador que apertou                    |
| position   | INT         | Ordem na rodada (1 = primeiro)        |
| timestamp  | TIMESTAMP   | Momento exato do clique               |

> `(round_id, player_id)` é único — um clique por jogador por rodada.

### `answers`

| Campo        | Tipo        | Descrição                              |
|-------------|-------------|----------------------------------------|
| id           | UUID        | Chave primária                        |
| round_id     | UUID (FK)   | Rodada                                 |
| player_id    | UUID (FK)   | Jogador que respondeu                  |
| option       | INT         | Alternativa escolhida (1..option_count) |
| position     | INT         | Ordem de chegada da resposta (1 = primeiro) |
| submitted_at | TIMESTAMP   | Momento do clique                     |
| is_correct   | BOOLEAN     | Preenchido na correção da rodada      |
| awarded_points | INT       | Pontos atribuídos (+points_first, +points_later ou 0) |

> `(round_id, player_id)` é único — uma resposta por jogador por rodada.
> A alternativa (`option`) fica oculta para os outros clientes até
> `rounds.answers_revealed = true`; o próprio jogador recebe a sua por evento
> personalizado (`resposta:minha`). No tipo "Ordem das Buzinas" a mesma
> entidade histórica `answers` pode ser usada para a resposta digitada.

---

## 3. Índices Sugeridos

```sql
CREATE INDEX idx_room_code ON rooms(code);
CREATE INDEX idx_room_players_room ON room_players(room_id);
CREATE INDEX idx_rounds_room ON rounds(room_id);
CREATE INDEX idx_buzzer_round ON buzzer_events(round_id);
CREATE INDEX idx_buzzer_order ON buzzer_events(round_id, position);
CREATE INDEX idx_answers_round ON answers(round_id);
CREATE INDEX idx_users_session ON users(session_id);
```

---

## 4. Métricas Futuras

Com os dados acima, é possível extrair:

| Métrica                          | Como calcular                                               |
|----------------------------------|-------------------------------------------------------------|
| **Taxa de acerto por jogador**   | `count(judgment IN ('na_mosca','raspando')) / total_answers`|
| **Tempo médio de buzina**        | `AVG(timestamp - round_started_at)` por jogador             |
| **Jogador mais rápido**          | Menor tempo médio de buzina                                 |
| **Ranking histórico**            | Soma de `score_delta` por jogador em todas as salas        |
| **Round mais acertado**          | Round com maior % de acerto                                 |
| **Evolução por rodada**          | `score_delta` acumulado ao longo das rodadas                |
| **Desempenho por tipo**          | Se categorizar perguntas (filmes, música, etc.)             |
| **Engajamento**                  | Nº de salas por jogador, tempo total em salas              |
| **Punições mais frequentes**     | Quem mais erra e recebe 3 rodadas sem buzinar                |

### Tabela de Agregados (opcional, para performance)

```sql
CREATE TABLE player_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_rooms INT DEFAULT 0,
  total_rounds INT DEFAULT 0,
  total_na_mosca INT DEFAULT 0,
  total_raspando INT DEFAULT 0,
  total_erros INT DEFAULT 0,
  total_pontos INT DEFAULT 0,
  avg_buzzer_time_ms INT DEFAULT 0,
  updated_at TIMESTAMP
);
```

Essa tabela pode ser atualizada via **eventos** (quando um `answer` é julgado, dispara update nas stats).

---

## 5. Considerações Finais

- **score_cache** em `room_players` evita ter que somar `answers.score_delta` toda vez que o placar for exibido. Atualizar a cada julgamento.
- **UUIDs** são preferíveis a `SERIAL` porque o sistema pode rodar em múltiplas instâncias no futuro.
- **session_id** permite reconexão: se o jogador perder a conexão, ao reconectar com o mesmo `session_id`, recupera seu estado na sala.
- A tabela `rounds.correct_answer` é opcional (só informativa pro apresentador). Pode vir do YouTube ou ser preenchida manualmente.
