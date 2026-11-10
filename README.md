# Quiz Show Controller

[![Site Online](https://img.shields.io/badge/site-online-2ea44f)](https://quizshowcontroller.onrender.com/)

Sistema web para controle de quiz/show de perguntas e respostas com suporte a múltiplos jogadores, sistema de buzzer, temporizador e integração com OBS para transmissão ao vivo.
<img width="1883" height="834" alt="image" src="https://github.com/user-attachments/assets/2394e897-2d72-4f9a-88fb-24179d56e996" />


## Site Online

O site está hospedado em: **https://quizshowcontroller.onrender.com/**

Acesse pelo navegador — não é necessário instalar nada. Para usar como fonte no OBS, basta apontar o *Browser Source* para essa mesma URL.

## Funcionalidades

- **Sala de Quiz** — Criação de salas com perguntas, respostas e categorias
- **Sistema de Buzzer** — Detecção de quem apertou primeiro (ordem de chegada)
- **Punição por erro** — Quem erra fica 3 rodadas sem poder buzinar, sem perder pontos
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
# Compila o TypeScript e roda os testes de identidade/presença e de punição
npm test
```

## Deploy

O projeto está publicado em **https://quizshowcontroller.onrender.com/**, hospedado no [Render](https://render.com/) como serviço Node.js.

### Configuração do serviço

| Item          | Valor                  |
|---------------|------------------------|
| Runtime       | Node.js 20+            |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start`            |
| Porta         | Definida pelo Render via variável `PORT` (localmente: `9000`) |

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
