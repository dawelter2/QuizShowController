# Integração com OBS

## Visão Geral

A tela de transmissão é uma página HTML dedicada que deve ser adicionada ao OBS como **Browser Source**. Ela não possui elementos de interação — apenas exibe o estado atual do jogo.

## Configuração no OBS

1. Abra o OBS Studio
2. Adicione uma nova fonte: **+ → Browser**
3. Configure:
   - **URL**: `http://localhost:3000/transmissao?sala=CODIGO_DA_SALA`
   - **Largura**: `1920`
   - **Altura**: `1080`
   - **FPS**: `30`
   - Marque **"Controlar áudio via OBS"** (se houver som)
4. Posicione a fonte como desejar

## Layout da Tela de Transmissão

```
┌──────────────────────────────────────────────┐
│  🏆 NOME DO QUIZ           ┌──────────────┐  │
│                              │ 00:25        │  │
│                              │ ████████░░░░ │  │
│                              └──────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │                                          │  │
│  │  Qual a capital do Brasil?               │  │
│  │                                          │  │
│  │  A) Rio de Janeiro                       │  │
│  │  B) Brasília  ← correta                 │  │
│  │  C) São Paulo                            │  │
│  │  D) Salvador                             │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Ordem dos Buzzers:  1. Ana  2. Bob  3. Carol  │
│                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ Ana  │ │ Bob  │ │Carol │ │David │          │
│  │ 150  │ │ 120  │ │ 90   │ │ 60   │          │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                 │
│  @streamer                          www.quiz.gg │
└──────────────────────────────────────────────┘
```

## Personalização

A tela de transmissão deve aceitar parâmetros de URL para personalização:

| Parâmetro   | Descrição                    | Exemplo               |
|-------------|------------------------------|-----------------------|
| `sala`      | Código da sala               | `?sala=ABC123`       |
| `tema`      | Tema de cores                | `?tema=dark`         |
| `logo`      | URL do logotipo              | `?logo=https://...`  |
| `titulo`    | Nome do quiz                 | `?titulo=Meu%20Quiz` |

## Transições e Animações

Para um visual profissional na transmissão:

- **Nova pergunta**: fade in suave
- **Buzzer apertado**: destaque no nome do jogador (borda brilhante)
- **Acerto**: animação verde + confetes (opcional)
- **Erro**: animação vermelha
- **Tempo crítico (<5s)**: timer pisca ou muda de cor

## Dicas

- Use fundo **transparente** ou **chroma key** no Browser Source
- A tela de transmissão **nunca** deve ter scroll — tudo precisa caber em 1920x1080
- Mantenha contraste alto (texto claro em fundo escuro ou vice-versa)
- Teste com o OBS antes da transmissão ao vivo
