# Visão Geral do Projeto

## Propósito

Sistema web para controlar dinâmicas de quiz/show ao vivo. Após autenticação, o usuário cria uma sala (vira apresentador) ou entra em uma sala como jogador. O apresentador controla rodadas e pontuação; os jogadores apertam buzina e escrevem respostas.

## Público-alvo

- Streamers e criadores de conteúdo que fazem lives de quiz/gincana
- Eventos online com interação ao vivo
- Grupos de amigos

## Conceitos Principais

### Autenticação
Entrada simples com nome (sem senha). Após entrar, o usuário escolhe entre **Criar Sala** ou **Entrar em uma Sala**.

### Apresentador
- Gera um código único para a sala
- Botões: **Começar Rodada**, **Próxima Rodada**
- Pode **adicionar ou remover pontos** de cada jogador individualmente

### Jogador
- Acessa a sala pelo código gerado
- Vê um **botão de buzina** e um **campo de texto** para escrever a resposta
- A ordem de quem apertou a buzina define a ordem de resposta

### Rodada
- Cada rodada começa com o apresentador liberando a buzina
- Jogadores apertam a buzina e escrevem suas respostas
- Apresentador pontua cada jogador
- Ao iniciar a próxima rodada, **os campos de resposta são limpos**, mas o **score acumulado permanece**

## Fluxo do Jogo

1. Usuário acessa o sistema e digita seu nome
2. Escolhe: **Criar Sala** (vira apresentador) ou **Entrar em Sala** (vira jogador)
3. Apresentador inicia a rodada — buzinas são liberadas
4. Jogadores apertam buzina e escrevem a resposta
5. Ordem dos buzzes é registrada e exibida
6. Apresentador atribui/remove pontos de cada jogador
7. Apresentador avança para a próxima rodada — campos de resposta limpam, score continua
