# Lógica de Negócio Detalhada

## 1. Autenticação

```
[Usuário chega na Home]
       |
       v
[Digita o nome]
       |
       v
┌───────────────────┐
│  Criar Sala       │  → Gera código único → vira Apresentador
│  Entrar em Sala   │  → Digita código → vira Jogador
└───────────────────┘
```

- Não há senha — apenas nome
- O nome **não é único globalmente** (duas "Anas" podem existir em salas diferentes)
- Dentro de uma mesma sala, o nome é único (comparação sem diferenciar maiúsculas/espaços)
  - Se já existir uma entrada **offline** com o mesmo nome, o jogador é reconectado a ela (pontos preservados)
  - Se já existir um jogador **online** com o mesmo nome, a entrada é recusada e o jogador escolhe outro nome
- "Mudar Nome" renomeia **no lugar**, sem criar outro usuário nem perder pontos
- Após criar ou entrar, o usuário é redirecionado para a tela correspondente

## 2. Sala

- Código gerado: 4 caracteres alfanuméricos maiúsculos (ex: `A3F9`)
- Ao criar, o apresentador escolhe o **tipo de jogo** e as opções da sala.
  Hoje existe apenas **Ordem das Buzinas**; novos tipos são registrados no
  catálogo do servidor (`GET /api/game-types`) e o lobby monta o formulário a
  partir dessa metadata.
- Opções da sala "Ordem das Buzinas" (a configuração atual é o default):
  - **URL do quiz no YouTube** — opcional; já é carregada automaticamente no painel do apresentador
  - **Número de rodadas** — `0` = sem limite
  - **Pontuação certeira** — default `3`
  - **Pontuação quase** — default `1`
  - **Tipo de punição** — rodadas sem buzinar (default `3`) ou subtrair pontos (default `3`)
- Os valores são validados no servidor na criação e ficam gravados na sala
- Uma sala só pode ter **um apresentador**
- Jogadores ilimitados entram pelo código
- A sala existe enquanto o apresentador estiver online (ou em memória)

## 3. Rodada

```
[Apresentador clica "Começar Rodada"]
       |
       v
[Servidor reseta estado: buzinas liberadas, campos limpos]
       |
       v
[Jogadores podem apertar buzina e digitar]
       |
       v
[Apresentador vê ordem das buzinas e respostas em tempo real]
       |
       v
[Apresentador pontua (+3/+1) ou aplica a punição de erro]
       |
       v
[Apresentador clica "Próxima Rodada"]
       |
       v
[Servidor: limpa buzinas e respostas, SCORE PERMANECE, punições avançam]
```

### Regras da Rodada

- **Buzina**: cada jogador só pode apertar **uma vez por rodada**. Segundo clique é ignorado.
- **Ordem**: definida pelo timestamp do servidor no momento do clique.
- **Campo de texto**: o jogador pode editar sua resposta **enquanto a rodada estiver ativa**.
- **Respostas vazias**: se o jogador apertou a buzina mas não escreveu nada, o apresentador vê o campo vazio.
- **Punição**: depende do tipo configurado na sala — **N rodadas sem buzinar** (default 3) ou **subtrair N pontos** (default 3).
- **Limite de rodadas**: quando a sala tem `total_rounds > 0`, o servidor recusa iniciar rodadas além do limite; `0` = sem limite.

## 4. Pontuação

- Score é **acumulativo** entre rodadas
- O apresentador controla os acertos com dois botões, cujos valores vêm da configuração da sala:
  - **Certeira** (default `+3`)
  - **Quase** (default `+1`)
- **Errou** aplica a punição configurada:
  - **Rodadas de punição**: fica sem buzinar nas próximas N rodadas (R+1 … R+N)
  - **Subtrair pontos**: perde N pontos na hora e continua podendo buzinar
- A punição por rodadas não acumula: se o jogador já está punido, uma nova punição é ignorada
- O contador da punição diminui a cada rodada (N → N−1 → … → 1) e libera a buzina depois da última
- Score inicial de cada jogador = 0
- Score nunca reseta, a menos que o apresentador reinicie a partida

## 5. Transmissão (OBS)

A tela de transmissão reflete o estado atual:

| Elemento            | Quando aparece                              |
|---------------------|---------------------------------------------|
| Rodada #           | Assim que "Começar Rodada" é pressionado    |
| Ordem das buzinas   | Conforme jogadores apertam                  |
| Respostas           | Conforme jogadores digitam                  |
| Placar              | Sempre visível, atualizado em tempo real    |

## 6. Limpeza entre Rodadas

| Item               | Limpa? | Persiste? |
|--------------------|--------|-----------|
| Ordem das buzinas  | ✅ Sim |           |
| Respostas escritas | ✅ Sim |           |
| Score dos jogadores|        | ✅ Sim   |
| Jogadores na sala  |        | ✅ Sim   |
| Punições           | ➖ 1 rodada por vez | ✅ Até cumprir as 3 |

## 7. Casos de Borda

| Situação                              | Comportamento                                      |
|---------------------------------------|----------------------------------------------------|
| Jogador apertou buzina 2x na rodada  | Segundo clique ignorado                            |
| Jogador punido tenta buzinar         | Servidor recusa (`PUNIDO`); buzina desabilitada    |
| Jogador punido termina a punição     | Volta a poder buzinar na rodada seguinte           |
| Jogador entrou no meio da rodada     | Buzina e resposta bloqueados até a próxima rodada  |
| Apresentador fecha o navegador       | Sala permanece em memória até a limpeza de inativas |
| Jogador fecha a aba / perde conexão  | Fica **offline** na lista (não é removido)          |
| Jogador reconecta com a mesma sessão | Mesma entrada, pontos/respostas preservados        |
| Jogador volta com sessão nova e nome igual, entrada antiga offline | Identidade antiga é adotada automaticamente; pontos preservados |
| Jogador tenta um nome já usado por alguém online na sala | Entrada recusada (`NAME_TAKEN`); escolhe outro nome |
| Apresentador remove jogador          | Sai da lista/placar; respostas da sala apagadas; a mesma sessão fica bloqueada até reiniciar a partida ou encerrar a sala |
| Apresentador muda de nome            | Renomeia no lugar; a sala continua sob o mesmo `presenter_id` |
| Ninguém aperta buzina                | Apresentador vê lista vazia, pode ir p/ próxima   |
| Todos apertaram mas ninguém escreveu | Apresentador vê respostas vazias                   |
