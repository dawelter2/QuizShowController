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
| Errou buzina 🚨       | 3 rodadas sem buzinar | Apertou e errou; não perde pontos e fica sem buzinar em R+1, R+2 e R+3 |
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
  🚨 Carol → "Batman" — errado e apertou buzina → punida por 3 rodadas
     (R2, R3 e R4), sem perder pontos → Carol: 0
```

**OBS atualiza:**
```
  ┌────────┐ ┌────────┐ ┌────────┐
  │  Ana   │ │  Bob   │ │ Carol  │
  │ 🟢 3   │ │ 🟢 3   │ │ 🚫 0   │
  └────────┘ └────────┘ └────────┘
  🏆 1. Bob 3 | 2. Ana 3 | 3. Carol 0
```

---

## Rodada 2 — Frame: Homem de preto com chapéu e um cachorro

> Vídeo mostra frame do **John Wick** ao lado do cachorro.

```
--- 0s: Frame aparece ---

  Ana buzina! (0.5s)    → Ana: 1º 🥇
  Bob buzina! (1.0s)    → Bob: 2º
  🚫 Carol está punida e não pode buzinar.

--- Jogadores digitam ---
  Ana:   "John Wick"
  Bob:   "Matrix"

--- 5s: Vídeo revela → "JOHN WICK" ---

Mestre julga:
  🎯 Ana → "John Wick" — na mosca, rápida → +3 pts → Ana: 6
  🚨 Bob → "Matrix" — errou e apertou buzina → punido por 3 rodadas
     (R3, R4 e R5), sem perder pontos → Bob: 3
```

**OBS atualiza:**
```
  ┌────────┐ ┌────────┐ ┌────────┐
  │  Ana   │ │  Bob   │ │ Carol  │
  │ 🟢 6   │ │ 🚫 3   │ │ 🚫 0   │
  └────────┘ └────────┘ └────────┘
  🏆 1. Ana 6 | 2. Bob 3 | 3. Carol 0
```

---

## Rodada 3 — Frame: Casal na popa de um navio

> Vídeo mostra frame de **Titanic** — Jack e Rose na popa.

```
--- 0s: Frame aparece ---

  Ana buzina! (1.0s) → Ana: 1º 🥇
  🚫 Bob e Carol estão punidos e não podem buzinar.

--- Jogadores digitam ---
  Ana: "Titanic"

--- 5s: Vídeo revela → "TITANIC" ---

Mestre julga:
  🎯 Ana → "Titanic" — na mosca → +3 pts → Ana: 9
```

**OBS atualiza:**
```
  🏆 1. Ana 9 | 2. Bob 3 | 3. Carol 0
```

---

## Rodada 4 — Frame: Carro voando entre prédios

> Frame de **Taxi Driver**? Não. É de **Mad Max**? Também não.
> É o frame clássico do carro da **Velozes e Furiosos 2** pulando entre dois barcos.

```
--- 0s: Frame aparece ---

  Ana buzina! (1.1s) → Ana: 1º 🥇
  🚫 Bob e Carol continuam punidos e não podem buzinar.

--- Jogadores digitam ---
  Ana: "Velozes e Furiosos 2"

--- 5s: Vídeo revela → "VELOZES E FURIOSOS 2" ---

Mestre julga:
  🎯 Ana → "Velozes e Furiosos 2" — na mosca! → +3 pts → Ana: 12
```

**OBS atualiza:**
```
  🏆 1. Ana 12 | 2. Bob 3 | 3. Carol 0
```

---

## Rodada 5 — Frame: Boneco verde assustador saindo de um espelho

> Frame de **It - A Coisa** (Pennywise no espelho).

```
--- 0s: Frame aparece ---

  Carol buzina! (0.8s) ← voltou da punição! → Carol: 1º 🥇
  Ana buzina! (1.2s)   → Ana: 2º
  🚫 Bob ainda está punido (última rodada) e não buzz.

--- Jogadores digitam ---
  Carol: "It - Capítulo 1"
  Ana:   "It - A Coisa"

--- 5s: Vídeo revela → "IT - A COISA" ---

Mestre julga:
  🎯 Ana → "It - A Coisa" — na mosca, ultra rápida → +3 pts → Ana: 15
  🫣 Carol → "It - Capítulo 1" — raspando (título correto é só "It" ou "It - A Coisa") → +1 pt → Carol: 1
```

---

## Placar Final

```
┌─────────────────────────────────────────────────────┐
│           🏆 CineQuiz — PLACAR FINAL                 │
├──────────┬──────────┬────────────────────────────────┤
│ Jogador  │ Pontos   │ Detalhamento                   │
├──────────┼──────────┼────────────────────────────────┤
│ 🥇 Ana  │   15     │ R1:+3 R2:+3 R3:+3 R4:+3 R5:+3 │
│ 🥈 Bob  │    3     │ R1:+3 (R2 errou: punido R3-R5)│
│ 🥉 Carol │    1     │ R1 errou: punida R2-R4; R5:+1 │
└──────────┴──────────┴────────────────────────────────┘
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
| Punido (sem buzinar) | `🚫` + contador | Vermelho |
