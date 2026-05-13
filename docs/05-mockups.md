# Descrição das Telas (Mockups)

## 1. Home

Layout centralizado com:
- Logotipo do sistema
- Campo para **criar nova sala** (gera código único)
- Campo para **entrar em sala existente** (insere o código)
- Botão de acesso rápido: "Entrar como Apresentador"

## 2. Painel do Apresentador

Dividido em seções:

### Barra Superior
- Código da sala (visível para compartilhar)
- Botão de compartilhar (copia link)
- Seletor de jogadores conectados

### Área Principal
- Pergunta atual em destaque
- Botões: "Mostrar Pergunta", "Mostrar Resposta", "Próxima"
- Lista de ordem dos buzzes (quem apertou primeiro)
- Controles do timer: iniciar, pausar, resetar, definir tempo
- Botões "Certa" / "Errada" para o jogador selecionado

### Sidebar
- Lista de perguntas da rodada
- Filtro por categoria
- Placar dos jogadores

## 3. Tela do Jogador (Celular)

Layout otimizado para mobile:

- Topo: nome do jogador e pontuação
- Centro: BOTÃO GRANDE do buzzer (ocupando a maior parte da tela)
  - Estado normal: cor vibrante
  - Apertado: feedback visual (muda de cor / vibra)
  - Bloqueado: acinzentado (enquanto pergunta não está ativa)
- Rodapé: status da conexão e código da sala

### Estados do Botão do Buzzer

| Estado     | Cor       | Comportamento               |
|------------|-----------|-----------------------------|
| Pronto     | Verde     | Aguardando pergunta         |
| Ativo      | Vermelho  | Pode apertar                |
| Apertado   | Amarelo   | Já apertou (posição X)      |
| Bloqueado  | Cinza     | Temporizador zerou / resposta dada |

## 4. Tela de Transmissão (OBS)

Ver documento específico: [04-obs-integration.md](./04-obs-integration.md)

## 5. Editor de Perguntas

- Tabela com perguntas cadastradas
- Botão "Nova Pergunta" abre formulário modal
- Formulário: pergunta, resposta, alternativas, categoria, tempo limite
- Botão de importar CSV/JSON
- Busca e filtro por categoria
