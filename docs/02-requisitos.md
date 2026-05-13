# Requisitos do Sistema

## Funcionais

### Autenticação

- Entrada com nome (sem senha)
- Após autenticar, duas opções: **Criar Sala** ou **Entrar em Sala**

### Sala

- Criar sala gera um código único (ex: 4 letras/números)
- Apresentador vê o código para compartilhar
- Jogadores entram na sala inserindo o código
- Sala só permite um apresentador

### Papel: Apresentador

- Botão **Começar Rodada** — libera buzinas para os jogadores e reseta campos de resposta
- Botão **Próxima Rodada** — limpa campos de resposta, mantém score
- Controles de **+1, +2, +5, -1, -2, -5** pontos para cada jogador
- Visualização da **ordem das buzinas** (quem apertou primeiro)
- Visualização das **respostas escritas** por cada jogador

### Papel: Jogador

- **Botão de buzina** — ao apertar, aparece sua posição na fila
- **Campo de texto** — digita a resposta da rodada
- Buzina e campo ficam **desabilitados** até o apresentador iniciar a rodada
- Ao iniciar nova rodada, buzina e campo são **limpos e reabilitados**

### Sistema de Buzina

- Apenas uma buzina por jogador por rodada
- Ordem cronológica de who apertou primeiro
- Apresentador vê a fila ordenada

### Pontuação

- Score acumulado por jogador através das rodadas
- Apresentador adiciona ou remove pontos manualmente
- Placar visível para todos (apresentador, jogadores, OBS)
- Score nunca reseta entre rodadas

### Tela de Transmissão (OBS)

- Layout limpo 1920x1080
- Mostra: pergunta/rodada atual, ordem das buzinas, respostas, placar
- Sem elementos de interação
- Personalização de cores/logotipo

## Não Funcionais

- **Tempo real**: buzina e respostas aparecem instantaneamente para o apresentador
- **Single Page Application**: sem recarregamento
- **Rodar localmente**: sem necessidade de servidor externo
- **Leve**: funciona em qualquer hardware de streaming
