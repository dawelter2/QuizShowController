# Simulação de Partida: 5 Perguntas de Matemática

## Participantes

| Papel        | Nome   |
|--------------|--------|
| Apresentador | Mestre |
| Jogador 1    | Ana    |
| Jogador 2    | Bob    |
| Jogador 3    | Carol  |

## Setup Inicial

```
Mestre acessa http://localhost:7000/
  → Digita nome: "Mestre"
  → Clicka em "Criar Sala"
  → Sala criada! Código: X7K9

Ana acessa http://localhost:7000/
  → Digita nome: "Ana"
  → Clicka em "Entrar em Sala"
  → Digita código: X7K9
  → Entrou! Vê tela de jogador (buzina desabilitada + campo texto desabilitado + score: 0)

Bob e Carol → mesmo processo, entram na sala X7K9

Mestre vê no painel:
  ✅ Ana conectada
  ✅ Bob conectado  
  ✅ Carol conectada
  [Botão: COMEÇAR RODADA]
```

---

## Rodada 1

> Pergunta: **"Quanto é 7 × 8?"**

```
Mestre clica "COMEÇAR RODADA"
  → Servidor libera buzinas e campos de texto
  → Todos os jogadores: buzina agora está VERDE (ativa), campo de texto habilitado
  → Tela OBS mostra: "Rodada 1" + "Quanto é 7 × 8?"

--- BUZINAS ---
Carol aperta buzina primeiro  (timestamp: 12:00:01.123)
Ana aperta buzina segundo    (timestamp: 12:00:01.456)
Bob aperta buzina terceiro   (timestamp: 12:00:02.001)

Mestre vê no painel:
  Ordem das buzinas:
    1º Carol 🎯
    2º Ana
    3º Bob

--- RESPOSTAS (cada um digita no seu celular) ---
Carol digita: "54"
Ana digita:   "56"
Bob digita:   "42"

Mestre vê as respostas em tempo real no painel:
  1º Carol: "54"
  2º Ana:   "56"
  3º Bob:   "42"

--- PONTUAÇÃO ---
Mestre decide:
  Ana acertou → clica "+2" no card da Ana    → Ana: 2 pts
  Carol errou → clica "-1" no card da Carol   → Carol: -1 pt
  Bob errou (mas quase) → clica "+1" no Bob   → Bob: 1 pt

Todos os jogadores veem o placar atualizado:
  🏆 Ana: 2  |  Bob: 1  |  Carol: -1
```

---

## Rodada 2

> Pergunta: **"Qual a raiz quadrada de 144?"**

```
Mestre clica "PRÓXIMA RODADA"
  → Buzinas liberadas novamente
  → Campos de texto limpos e habilitados
  → Score mantido: Ana 2 | Bob 1 | Carol -1

--- BUZINAS ---
Ana aperta buzina primeiro (timestamp: 12:05:00.000)
Bob aperta buzina segundo  (timestamp: 12:05:00.200)
Carol aperta buzina terceiro (timestamp: 12:05:00.500)

--- RESPOSTAS ---
Ana digita:   "12"
Bob digita:   "12"
Carol digita: "13"

--- PONTUAÇÃO ---
Mestre decide:
  Ana acertou → +2    → Ana: 4 pts
  Bob acertou → +2    → Bob: 3 pts
  Carol errou → -1    → Carol: -2 pts

Placar:
  🏆 Ana: 4  |  Bob: 3  |  Carol: -2
```

---

## Rodada 3

> Pergunta: **"Quanto é 15% de 200?"**

```
Mestre clica "PRÓXIMA RODADA"

--- BUZINAS ---
Bob aperta buzina primeiro (timestamp: 12:10:00.000)
Carol aperta buzina segundo (timestamp: 12:10:00.050)
Ana aperta buzina terceiro (timestamp: 12:10:00.300)

--- RESPOSTAS ---
Bob digita:   "30"
Carol digita: "15"

  ⚠️ Ana apertou buzina mas NÃO digitou resposta (campo vazio)
  → Mestre vê: Ana: (vazio)

--- PONTUAÇÃO ---
Mestre decide:
  Bob acertou  → +2    → Bob: 5 pts
  Carol errou  → -1    → Carol: -3 pts
  Ana não respondeu → 0 → Ana: 4 pts

Placar:
  🏆 Bob: 5  |  Ana: 4  |  Carol: -3
```

---

## Rodada 4

> Pergunta: **"Qual o resultado de 2⁵ (2 elevado à 5ª potência)?"**

```
Mestre clica "PRÓXIMA RODADA"

--- BUZINAS ---
Ana aperta buzina primeiro (timestamp: 12:15:00.000)
Bob tenta apertar buzina de novo (SEGUNDO CLIQUE)
  → Servidor IGNORA (já apertou essa rodada)

Carol aperta buzina segundo (timestamp: 12:15:00.300)
Bob NÃO apertou (seu clique foi ignorado)
  → Bob não aparece na ordem

--- RESPOSTAS ---
Ana digita:   "32"
Carol digita: "64"

--- PONTUAÇÃO ---
Mestre decide:
  Ana acertou  → +2    → Ana: 6 pts
  Carol errou  → 0     → Carol: -3 pts
  Bob não apertou → N/A → Bob: 5 pts

Placar:
  🏆 Ana: 6  |  Bob: 5  |  Carol: -3
```

---

## Rodada 5

> Pergunta: **"Se x + 5 = 12, qual o valor de x?"**

```
Mestre clica "PRÓXIMA RODADA"

--- BUZINAS ---
Carol aperta buzina primeiro (timestamp: 12:20:00.000)
Ana aperta buzina segundo   (timestamp: 12:20:00.100)
Bob aperta buzina terceiro  (timestamp: 12:20:00.200)

--- RESPOSTAS (enquanto escrevem) ---
Carol digita: "7"
Ana digita:   "6"
Bob digita:   "7"

--- PONTUAÇÃO ---
Mestre decide:
  Carol acertou → +3  (deu +3 por ser a última rodada) → Carol: 0 pts
  Ana errou     → 0                                     → Ana: 6 pts
  Bob acertou   → +2                                    → Bob: 7 pts
```

---

## Placar Final

```
┌─────────────────────────────────────────────┐
│              🏆 PLACAR FINAL                 │
├──────────┬──────────┬──────────────────────┤
│ Jogador  │ Pontos   │ Histórico            │
├──────────┼──────────┼──────────────────────┤
│ 🥇 Bob  │    7     │ R1:+1 R2:+2 R3:+2 R5:+2 │
│ 🥈 Ana  │    6     │ R1:+2 R2:+2 R4:+2       │
│ 🥉 Carol │    0     │ R1:-1 R2:-1 R3:-1 R5:+3 │
└──────────┴──────────┴──────────────────────┘
```

---

## Casos de Borda Cobertos na Simulação

| Caso | Ocorreu em | Comportamento |
|---|---|---|
| Jogador apertou buzina 2x na mesma rodada | Rodada 4 (Bob) | Segundo clique ignorado |
| Jogador apertou buzina mas não respondeu | Rodada 3 (Ana) | Campo vazio, apresentador vê, 0 pontos |
| Jogador errou e levou pontos negativos | Rodada 1 e 2 (Carol) | -1 possível |
| Apresentador deu pontuação diferente do padrão | Rodada 5 (Carol +3) | Valor livre |
| Todos apertaram buzina | Todas as rodadas | Ordem sempre registrada |
