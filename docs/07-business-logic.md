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
- **Punição**: quem erra fica **3 rodadas sem poder buzinar** (R+1, R+2 e R+3 após o erro).

## 4. Pontuação

- Score é **acumulativo** entre rodadas
- O apresentador controla os acertos:
  - Botões de atalho: `+3` (na mosca) e `+1` (raspando)
  - Erro: botão **Errou**, que aplica **3 rodadas de punição** em vez de retirar pontos
- A punição não acumula: se o jogador já está punido, uma nova punição é ignorada
- O contador da punição diminui a cada rodada (3 → 2 → 1) e libera a buzina depois da terceira
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
