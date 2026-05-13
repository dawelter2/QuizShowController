# Arquitetura do Sistema

## Diagrama de Telas

```
┌─────────────────────────────────────────────────┐
│                   APRESENTADOR                   │
│  (Notebook principal)                            │
│  ┌───────────────────────────────────────────┐  │
│  │ Painel de Controle                         │  │
│  │ - Lista de jogadores com botões +/- pontos │  │
│  │ - Botão "Começar Rodada"                  │  │
│  │ - Botão "Próxima Rodada"                  │  │
│  │ - Ordem das buzinas                        │  │
│  │ - Respostas dos jogadores                  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────┘
                      │ WebSocket
                      │
┌─────────────────────┼───────────────────────────┐
│                     ▼                             │
│  ┌──────────────┐      ┌──────────────────────┐  │
│  │ Jogador (N)   │      │ Tela de Transmissão  │  │
│  │ (Celular)     │      │ (OBS Browser Source) │  │
│  │ - Buzina      │      │ - Rodada atual       │  │
│  │ - Campo texto │      │ - Ordem buzinas      │  │
│  │ - Score       │      │ - Respostas          │  │
│  └──────────────┘      │ - Placar             │  │
│                         └──────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │              SERVIDOR                         │  │
│  │  - Salas (código → {apresentador, jogadores}) │  │
│  │  - Estado da rodada                          │  │
│  │  - Ordem das buzinas                        │  │
│  │  - Respostas dos jogadores                   │  │
│  │  - Scoreboard                                │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Estrutura de Rotas (Frontend)

| Rota              | Tela                        |
|-------------------|-----------------------------|
| `/`               | Autenticação (digitar nome) |
| `/criar-sala`     | Criar sala → vira apresentador |
| `/entrar-sala`    | Inserir código da sala      |
| `/apresentador`   | Painel do apresentador      |
| `/jogador`        | Tela do jogador (buzina + texto) |
| `/transmissao`    | Tela para OBS               |

## Estrutura de Eventos WebSocket

| Evento                        | Direção           | Descrição                         |
|-------------------------------|-------------------|-----------------------------------|
| `sala:criar`                  | Cliente → Servidor | Criar sala, retorna código       |
| `sala:entrar`                 | Cliente → Servidor | Entrar em sala com código        |
| `sala:jogadores`              | Servidor → Todos   | Lista de jogadores atualizada    |
| `rodada:iniciar`              | Apresentador → Servidor | Libera buzinas e reseta campos |
| `rodada:iniciada`             | Servidor → Todos   | Sinal que nova rodada começou    |
| `buzina:apertar`              | Jogador → Servidor | Jogador apertou buzina           |
| `buzina:ordem`               | Servidor → Todos   | Ordem atualizada das buzinas     |
| `resposta:escrever`           | Jogador → Servidor | Jogador digitou resposta         |
| `resposta:atualizada`         | Servidor → Apresentador | Resposta do jogador         |
| `rodada:proxima`              | Apresentador → Servidor | Limpa campos, mantém score   |
| `pontos:alterar`              | Apresentador → Servidor | +N ou -N pontos para jogador |
| `placar:atualizado`           | Servidor → Todos   | Scoreboard atualizado            |
| `sala:status`                 | Servidor → Cliente | Estado completo da sala          |
