# Simulação: Videocast de Quiz de Filmes

## Formato

- Um vídeo do YouTube é compartilhado na tela
- O vídeo mostra um **frame de um filme**
- Após **5 segundos**, o vídeo revela a **resposta** (nome do filme)
- Os jogadores precisam buzinar e **responder antes dos 5s**
- Quem buzinar **primeiro e errar** é punido

## Regras de Pontuação

| Critério              | Pontos | Descrição                                    |
|-----------------------|--------|----------------------------------------------|
| Na mosca 🎯           |  +3    | Resposta exata e rápida                      |
| Raspando 🫣           |  +1    | Acertou o filme mas com hesitação/quase      |
| Errou buzina 🚨       |  -2    | Apertou primeiro e errou (punição)           |
| Não respondeu         |   0    | Não apertou buzina ou não escreveu nada      |

> *Nota: o apresentador decide se foi "na mosca" ou "raspando" baseado na resposta e no tempo.*

## Setup

```
🎙️ Videocast: "CineQuiz com a Galera"
👤 Apresentador: Mestre
👥 Jogadores: Ana, Bob, Carol
📺 Tela OBS: vídeo do YouTube + placar + status dos jogadores + câmeras
```

---

## Pré-Jogo

```
1. Cada um abre o site no próprio celular
2. Digita o nome e entra na sala
3. OBS está capturando:
   ┌──────────────────────────────────────┐
   │  [YouTube: frame do filme]           │
   │  ┌────────┐ ┌────────┐ ┌────────┐   │
   │  │  Ana   │ │  Bob   │ │ Carol  │   │
   │  │ 🟢 0   │ │ 🟢 0   │ │ 🟢 0   │   │
   │  └────────┘ └────────┘ └────────┘   │
   │  ┌──────────────────────────────┐   │
   │  │ 🏆 RANKING                   │   │
   │  │ 1. Ana — 0 pts               │   │
   │  │ 2. Bob — 0 pts               │   │
   │  │ 3. Carol — 0 pts             │   │
   │  └──────────────────────────────┘   │
   │  🎥 [câmera Mestre] [câmera Ana]   │
   │     [câmera Bob]   [câmera Carol]  │
   └──────────────────────────────────────┘

Mestre clica "COMEÇAR RODADA"
  → Buzinas liberadas 🟢
  → Todos os jogadores: botão verde + campo de texto ativo
```

---

## Rodada 1 — Frame: Coringa dançando na escadaria

> Vídeo mostra frame do **Coringa (2019)** dançando na escadaria.

```
--- 0s: Frame aparece ---

  Bob buzina! (0.8s)   → Bob: 1º 🥇
  Ana buzina! (1.2s)   → Ana: 2º
  Carol buzina! (2.0s) → Carol: 3º

--- Jogadores digitam ---
  Bob:   "Coringa"
  Ana:   "Joker"
  Carol: "Batman"

--- 5s: Vídeo revela → "CORINGA (2019)" ---

Mestre julga:
  🎯 Bob → "Coringa" — resposta certa, na mosca → +3 pts → Bob: 3
  🎯 Ana → "Joker" — nome original, na mosca → +3 pts → Ana: 3
  🚨 Carol → "Batman" — errado e apertou buzina → -2 pts → Carol: -2
```

**OBS atualiza:**
```
  ┌────────┐ ┌────────┐ ┌────────┐
  │  Ana   │ │  Bob   │ │ Carol  │
  │ 🟢 3   │ │ 🟢 3   │ │ 🔴 -2  │
  └────────┘ └────────┘ └────────┘
  🏆 1. Bob 3 | 2. Ana 3 | 3. Carol -2
```

---

## Rodada 2 — Frame: Homem de preto com chapéu e um cachorro

> Vídeo mostra frame do **John Wick** ao lado do cachorro.

```
--- 0s: Frame aparece ---

  Ana buzina! (0.5s)    → Ana: 1º 🥇
  Bob buzina! (1.0s)    → Bob: 2º
  Carol buzina! (1.3s)  → Carol: 3º

--- Jogadores digitam ---
  Ana:   "John Wick"
  Bob:   "Matrix"
  Carol: "John Wick 2"

--- 5s: Vídeo revela → "JOHN WICK" ---

Mestre julga:
  🎯 Ana → "John Wick" — na mosca, rápida → +3 pts → Ana: 6
  🚨 Bob → "Matrix" — errou e apertou buzina → -2 pts → Bob: 1
  🫣 Carol → "John Wick 2" — certa a franquia, mas errou o filme, raspando → +1 pt → Carol: -1
```

**OBS atualiza:**
```
  ┌────────┐ ┌────────┐ ┌────────┐
  │  Ana   │ │  Bob   │ │ Carol  │
  │ 🟢 6   │ │ 🟡 1   │ │ 🔴 -1  │
  └────────┘ └────────┘ └────────┘
  🏆 1. Ana 6 | 2. Bob 1 | 3. Carol -1
```

---

## Rodada 3 — Frame: Casal na popa de um navio

> Vídeo mostra frame de **Titanic** — Jack e Rose na popa.

```
--- 0s: Frame aparece ---

  ninguém buzina... ⏳
  ninguém buzina... ⏳

--- 5s: Vídeo revela → "TITANIC" ---

  Ninguém apertou a buzina!
  → Todos: 0 pts

Mestre: "Gente, TITANIC! Era muito fácil!" 😂
```

**OBS atualiza:**
```
  🏆 1. Ana 6 | 2. Bob 1 | 3. Carol -1
  (sem alterações)
```

---

## Rodada 4 — Frame: Carro voando entre prédios

> Frame de **Taxi Driver**? Não. É de **Mad Max**? Também não.
> É o frame clássico do carro da **Velozes e Furiosos 2** pulando entre dois barcos.

```
--- 0s: Frame aparece ---

  Carol buzina! (1.1s)  → Carol: 1º 🥇
  Bob buzina! (2.0s)    → Bob: 2º
  Ana buzina! (2.5s)    → Ana: 3º

--- Jogadores digitam ---
  Carol: "Velozes e Furiosos 2"
  Bob:   "Fast and Furious 2"
  Ana:   "Velozes e Furiosos"

--- 5s: Vídeo revela → "VELOZES E FURISOS 2" ---

Mestre julga:
  🎯 Carol → "Velozes e Furiosos 2" — na mosca! → +3 pts → Carol: 2
  🎯 Bob → "Fast and Furious 2" — na mosca (inglês vale) → +3 pts → Bob: 4
  🫣 Ana → "Velozes e Furiosos" — raspando (sem o 2) → +1 pt → Ana: 7
```

**OBS atualiza:**
```
  🏆 1. Ana 7 | 2. Bob 4 | 3. Carol 2
```

---

## Rodada 5 — Frame: Boneco verde assustador saindo de um espelho

> Frame de **It - A Coisa** (Pennywise no espelho).

```
--- 0s: Frame aparece ---

  Ana buzina! (0.3s) ← muito rápida!
  Bob buzina! (0.6s)
  Carol buzina! (0.8s)

--- Jogadores digitam ---
  Ana:   "It - A Coisa"
  Bob:   "It - Capítulo 1"
  Carol: "Palhaço Assassino" ← não é o nome oficial

--- 5s: Vídeo revela → "IT - A COISA" ---

Mestre julga:
  🎯 Ana → "It - A Coisa" — na mosca, ultra rápida → +3 pts → Ana: 10
  🫣 Bob → "It - Capítulo 1" — raspando (título correto é só "It" ou "It - A Coisa") → +1 pt → Bob: 5
  🚨 Carol → "Palhaço Assassino" — errado e apertou buzina → -2 pts → Carol: 0
```

---

## Placar Final

```
┌─────────────────────────────────────────────┐
│         🏆 CineQuiz — PLACAR FINAL           │
├──────────┬──────────┬────────────────────────┤
│ Jogador  │ Pontos   │ Detalhamento           │
├──────────┼──────────┼────────────────────────┤
│ 🥇 Ana  │   10     │ R1:+3 R2:+3 R4:+1 R5:+3 │
│ 🥈 Bob  │    5     │ R1:+3 R2:-2 R4:+3 R5:+1 │
│ 🥉 Carol │    0     │ R1:-2 R2:+1 R4:+3 R5:-2 │
└──────────┴──────────┴────────────────────────┘
```

---

## Layout Final do OBS (Tela de Transmissão)

```
┌──────────────────────────────────────────────────────┐
│                    🎬 CINEQUIZ                        │
│                 ┌──────────────┐                      │
│                 │ 🕒 RODADA 5  │                      │
│                 └──────────────┘                      │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │           [VÍDEO DO YOUTUBE]                 │    │
│  │      (frame do filme sendo exibido)          │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Ordem das Buzinas:                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐                         │
│  │ 🥇   │ │ 🥈   │ │ 🥉   │                         │
│  │ Ana  │ │ Bob  │ │Carol │                         │
│  │ 🎯   │ │ 🫣   │ │ 🚨   │                         │
│  └──────┘ └──────┘ └──────┘                         │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  🏆 RANKING                                   │    │
│  │  🥇 Ana   ■■■■■■■■■■■■■■■■■■■■  10 pts       │    │
│  │  🥈 Bob   ■■■■■■■■■               5 pts       │    │
│  │  🥉 Carol ■                       0 pts       │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │🎙️Mestre│ │📷 Ana  │ │📷 Bob  │ │📷 Carol│        │
│  └────────┘ └────────┘ └────────┘ └────────┘        │
└──────────────────────────────────────────────────────┘
```

---

## Comportamento dos Status no OBS

| Estado do Jogador | Indicador | Cor |
|---|---|---|
| Aguardando rodada | `⚪` | Cinza |
| Buzina liberada | `🟢` | Verde |
| Buzinou (posição X) | `🟡` + `🥇🥈🥉` | Amarelo |
| Resposta submetida | `📝` | Azul |
| Acertou (na mosca) | `🎯` | Verde brilhante |
| Acertou (raspando) | `🫣` | Laranja |
| Errou | `🚨` | Vermelho piscando |
