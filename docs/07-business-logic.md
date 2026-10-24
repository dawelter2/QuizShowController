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
[Apresentador pontua manualmente cada jogador]
       |
       v
[Apresentador clica "Próxima Rodada"]
       |
       v
[Servidor: limpa buzinas e respostas, SCORE PERMANECE]
```

### Regras da Rodada

- **Buzina**: cada jogador só pode apertar **uma vez por rodada**. Segundo clique é ignorado.
- **Ordem**: definida pelo timestamp do servidor no momento do clique.
- **Campo de texto**: o jogador pode editar sua resposta **enquanto a rodada estiver ativa**.
- **Respostas vazias**: se o jogador apertou a buzina mas não escreveu nada, o apresentador vê o campo vazio.

## 4. Pontuação

- Score é **acumulativo** entre rodadas
- O apresentador controla **manualmente**:
  - Botões de atalho: `+1`, `+2`, `+5`, `-1`, `-2`, `-5`
  - (Ou campo personalizado para digitar valor)
- Não há regra automática de certo/errado — o apresentador decide quanto dar
- Score inicial de cada jogador = 0
- Score nunca reseta, a menos que o apresentador recrie a sala

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

## 7. Casos de Borda

| Situação                              | Comportamento                                      |
|---------------------------------------|----------------------------------------------------|
| Jogador apertou buzina 2x na rodada  | Segundo clique ignorado                            |
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
