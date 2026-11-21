# Quiz Show Controller

[![Site Online](https://img.shields.io/badge/site-online-2ea44f)](https://quizshowcontroller.onrender.com/)

Sistema web para controle de quiz/show de perguntas e respostas com suporte a múltiplos jogadores, sistema de buzzer, temporizador e integração com OBS para transmissão ao vivo.

## Site Online

O site está hospedado em: **https://quizshowcontroller.onrender.com/**

Acesse pelo navegador — não é necessário instalar nada. Para usar como fonte no OBS, basta apontar o *Browser Source* para essa mesma URL.

## Funcionalidades

- **Sala de Quiz configurável** — Tipos de jogo **"Ordem das Buzinas"** e **"Respostas"**, URL do quiz no YouTube, número de rodadas, pontuação e punições
- **Tipo Respostas** — Alternativas em grid (A–F ou 1–6), uma escolha por jogador, revelação automática (ou manual para AFK), correção pelo apresentador e pontuação maior para quem acertar primeiro
- **Sistema de Buzzer** — Detecção de quem apertou primeiro (ordem de chegada)
- **Punição por erro configurável** — Rodadas sem buzinar (default 3) ou subtração de pontos (default 3)
- **Temporizador** — Contagem regressiva para responder cada pergunta
- **Painel do Apresentador** — Interface para controlar o jogo (mostrar pergunta, revelar resposta, pontuar)
- **Tela de Transmissão (OBS)** — Layout limpo e personalizável para ser capturado como fonte de navegador no OBS
- **Ranking ao Vivo** — Placar atualizado em tempo real
- **Página de teste de Respostas** — `/respostas-demo` cria uma sala real com 4 jogadores simulados para validar o fluxo completo
- **Página de teste de Ordem das Buzinas** — `/buzinas-demo` cria uma sala real com 4 jogadores simulados para validar cliques, ordem, pontuação e punições
- **Múltiplos Jogadores** — Suporte a N jogadores com dispositivos próprios (celular/tablet)

## Estrutura do Projeto

```
quiz-show-controller/
├── docs/               # Documentação do projeto
├── src/                # Código fonte
│   └── public/         # Assets estáticos (HTML/CSS/JS servidos pelo Express)
├── tests/              # Testes automatizados
├── Dockerfile          # Build de produção (opcional)
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

> Já quer usar sem instalar nada? Acesse a versão online em **https://quizshowcontroller.onrender.com/**.
> As instruções abaixo são para rodar o projeto localmente (desenvolvimento).

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd quiz-show-controller

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## Testes

```bash
# Compila o TypeScript e roda os testes de identidade/presença, punição,
# configuração de sala e fluxo do tipo Respostas
npm test
```

Para validar a interface do tipo **Respostas** sem montar uma partida real,
suba o servidor e abra `http://localhost:9000/respostas-demo`. A página cria uma
sala de verdade com quatro jogadores simulados, permitindo testar grid, ocultação
das respostas, revelação manual, correção e pontuação do primeiro acerto.

Para validar o tipo **Ordem das Buzinas**, abra
`http://localhost:9000/buzinas-demo`. A página também cria uma sala real com
quatro jogadores simulados e reproduz o painel do apresentador e os celulares,
permitindo testar a ordem dos cliques, a pontuação certeira/quase, a punição por
erro (rodadas ou pontos), o limite de rodadas e o auto-avanço.

## Deploy

O projeto está publicado em **https://quizshowcontroller.onrender.com/**, hospedado no [Render](https://render.com/) como serviço Node.js.

### Configuração do serviço

| Item          | Valor                  |
|---------------|------------------------|
| Runtime       | Node.js 20+            |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start`            |
| Porta         | Definida pelo Render via variável `PORT` (localmente: `9000`) |

> O `npm run build` compila o TypeScript e copia `src/public` para
> `dist/public`, então o `npm start` (que serve `dist`) já encontra os HTML/CSS/JS
> atualizados — incluindo as páginas `/respostas-demo` e `/buzinas-demo`.

### Publicar uma nova versão

1. Faça commit e push para o branch conectado ao serviço no Render.
2. O Render executa o build e reinicia a aplicação automaticamente.
3. Confira o resultado em https://quizshowcontroller.onrender.com/.

### Rodar como container (opcional)

O repositório inclui um `Dockerfile` multi-stage pronto para produção:

```bash
docker build -t quiz-show-controller .
docker run -p 9000:9000 quiz-show-controller
```

### Observações

- O estado do jogo (salas, rodadas, buzzers) fica **em memória**: reiniciar o serviço encerra as salas ativas.
- Se o serviço estiver no plano gratuito do Render, ele hiberna após um período sem acessos — a primeira requisição pode levar alguns segundos até "acordar".

## Licença

MIT
