# Quiz Show Controller

Sistema web para controle de quiz/show de perguntas e respostas com suporte a múltiplos jogadores, sistema de buzzer, temporizador e integração com OBS para transmissão ao vivo.

## Funcionalidades

- **Sala de Quiz** — Criação de salas com perguntas, respostas e categorias
- **Sistema de Buzzer** — Detecção de quem apertou primeiro (ordem de chegada)
- **Temporizador** — Contagem regressiva para responder cada pergunta
- **Painel do Apresentador** — Interface para controlar o jogo (mostrar pergunta, revelar resposta, pontuar)
- **Tela de Transmissão (OBS)** — Layout limpo e personalizável para ser capturado como fonte de navegador no OBS
- **Ranking ao Vivo** — Placar atualizado em tempo real
- **Múltiplos Jogadores** — Suporte a N jogadores com dispositivos próprios (celular/tablet)

## Estrutura do Projeto

```
quiz-show-controller/
├── docs/               # Documentação do projeto
├── src/                # Código fonte
├── public/             # Assets estáticos
└── README.md
```

## Tecnologias Sugeridas

| Camada       | Tecnologia                     |
|-------------|--------------------------------|
| Frontend    | React / Next.js / Vue.js       |
| Backend     | Node.js + Socket.IO            |
| Database    | SQLite (local) ou PostgreSQL   |
| Tempo Real  | WebSocket (Socket.IO)          |
| Estilo      | Tailwind CSS / Bootstrap       |
| OBS         | Browser Source (HTML + CSS)    |

## Primeiros Passos

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd quiz-show-controller

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## Licença

MIT
