# Requisitos do Sistema

## Funcionais

### Autenticação

- Entrada com nome (sem senha)
- Após autenticar, duas opções: **Criar Sala** ou **Entrar em Sala**

### Sala

- Criar sala gera um código único (ex: 4 letras/números)
- Na criação, o apresentador escolhe o **tipo de jogo** e as opções da sala:
  - **Ordem das Buzinas**:
    - URL do quiz no YouTube (opcional)
    - Número de rodadas (0 = sem limite)
    - Pontuação certeira e pontuação quase
    - Tipo de punição: rodadas sem buzinar ou subtrair pontos
  - **Respostas**:
    - URL do vídeo no YouTube (opcional)
    - Quantidade de opções (1 a 6)
    - Tipo de opções (alfabético A–F ou numérico 1–6)
    - Pontos para quem acertar primeiro e para quem acertar depois
- Apresentador vê o código para compartilhar
- Jogadores entram na sala inserindo o código
- Sala só permite um apresentador

### Papel: Apresentador

- Botão **Começar Rodada** — libera buzinas para os jogadores e reseta campos de resposta
- Botão **Próxima Rodada** — limpa campos de resposta, mantém score
- Botões de acerto com os valores configurados na sala (**certeira** e **quase**) e **Errou** para aplicar a punição configurada
- Visualização da **ordem das buzinas** (quem apertou primeiro)
- Visualização das **respostas escritas** por cada jogador
- No tipo **Respostas**: vê a **ordem das respostas** com a alternativa oculta (`?`), pode **revelar as respostas** manualmente (AFK), escolhe a alternativa correta e aplica os pontos
- Com **Auto-próxima rodada** ligado, a próxima rodada abre após a correção; desligado, espera o clique em **Próxima Rodada**

### Papel: Jogador

- **Botão de buzina** — ao apertar, aparece sua posição na fila
- **Campo de texto** — digita a resposta da rodada
- No tipo **Respostas**: grid de 2 colunas com as alternativas (A–F ou 1–6); o clique é liberado quando a rodada começa e **só pode ser feito uma vez**
- As 4 primeiras alternativas cabem na tela; com 5 ou 6 opções a área do grid ganha scroll
- Buzina/campo/grid ficam **desabilitados** até o apresentador iniciar a rodada
- Ao iniciar nova rodada, os controles são **limpos e reabilitados**

### Sistema de Buzina

- Apenas uma buzina por jogador por rodada
- Ordem cronológica de who apertou primeiro
- Apresentador vê a fila ordenada

### Pontuação

- Score acumulado por jogador através das rodadas
- Acertos somam os pontos definidos na configuração da sala (default: `+3` certeira, `+1` quase)
- **Erro** aplica a punição configurada na sala:
  - **Rodadas de punição** (default 3): jogador fica sem poder buzinar nas N rodadas seguintes
  - **Subtrair pontos** (default 3): jogador perde N pontos na hora e continua podendo buzinar
- A punição por rodadas não acumula: se o jogador já está punido, uma nova punição é ignorada
- A punição por rodadas termina sozinha após a última rodada; **Reiniciar Partida** limpa todas as punições
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
