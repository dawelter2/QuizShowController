# Integração com OBS

## Visão Geral

A tela de transmissão é uma página HTML dedicada que deve ser adicionada ao OBS como **Browser Source**. Ela não possui elementos de interação — apenas exibe o estado atual do jogo.

URL da tela: `http://localhost:7000/score?sala=CODIGO_DA_SALA`

Atalho: no menu do apresentador, clique em **📺 Abrir Transmissão** — abre essa URL em uma nova aba já com a sala preenchida.

## Modo 1: cena cheia (1920×1080)

Use quando você quer adicionar a tela inteira como uma única fonte.

1. Abra o OBS Studio
2. Adicione uma nova fonte: **+ → Browser**
3. Configure:
   - **URL**: `http://localhost:7000/score?sala=CODIGO_DA_SALA`
   - **Largura**: `1920`
   - **Altura**: `1080`
   - **FPS**: `30`
4. Posicione a fonte como desejar

## Modo 2: widgets isolados (recomendado)

A tela `/score` é composta de **widgets independentes**, cada um com seu próprio `id`. Você pode adicionar várias Browser Sources apontando para a **mesma URL**, e usar o campo **"Custom CSS"** de cada uma pra mostrar só o widget que importa.

### Widgets disponíveis

| ID                  | Descrição                                                | Tamanho sugerido |
|---------------------|----------------------------------------------------------|------------------|
| `#widget-ranking`   | Ranking ao vivo (top N com medalhas, glow dourado no 1º) | 420×700          |
| `#widget-buzzers`   | Ordem das buzinas da rodada atual (some entre rodadas)   | 1200×120         |
| `#widget-round`     | Badge da rodada atual ("Rodada 3" / "Aguardando...")     | 320×80           |
| `#widget-players`   | Chips horizontais com avatar+nome+score de cada jogador  | 1600×80          |

### Como isolar um widget

Adicione uma Browser Source apontando para `http://localhost:7000/score?sala=CODIGO` e cole o snippet abaixo no campo **Custom CSS**.

**Só o Ranking:**
```css
body > *:not(#widget-ranking) { display: none !important; }
body { background: transparent !important; }
#widget-ranking { position: static !important; margin: 0 !important; }
```

**Só as Buzinas:**
```css
body > *:not(#widget-buzzers) { display: none !important; }
body { background: transparent !important; }
#widget-buzzers { position: static !important; margin: 0 auto !important; }
```

**Só o badge da Rodada:**
```css
body > *:not(#widget-round) { display: none !important; }
body { background: transparent !important; }
#widget-round { position: static !important; margin: 0 !important; }
```

**Só os Chips dos Jogadores:**
```css
body > *:not(#widget-players) { display: none !important; }
body { background: transparent !important; }
#widget-players { position: static !important; margin: 0 !important; }
```

> O `position: static !important` reset é importante: na cena cheia os widgets usam `position: absolute` pra serem posicionados na tela 1920×1080. Quando isolados como Browser Source, você quer que o widget ocupe a fonte inteira no tamanho que você definir no OBS.

### Animações já inclusas

- **GO!** gigante centralizado quando a rodada inicia (~600ms).
- Ranking com **count-up animado** dos scores e **reordenação suave** (FLIP) quando alguém ultrapassa outro.
- **Glow dourado** pulsando no 1º lugar (ranking e buzinas).
- **Slide-in** dos novos cards na ordem das buzinas.
- "**AO VIVO**" pulsando discreto no header do ranking.

## Parâmetros de URL

| Parâmetro | Descrição          | Exemplo         | Status |
|-----------|--------------------|-----------------|--------|
| `sala`    | Código da sala     | `?sala=X7K9`    | ✅ ativo |
| `tema`    | Tema visual (a/b/c/d) | `?tema=b`    | ✅ ativo |
| `logo`    | URL do logotipo    | `?logo=https://` | 🚧 planejado |
| `titulo`  | Nome do quiz       | `?titulo=Quiz`  | 🚧 planejado |

### Temas disponíveis

A tela `/score` tem 4 visuais diferentes pros widgets Ranking e Buzinas. Você escolhe via:

- **Switcher visual**: botões `A/B/C/D` no canto inferior esquerdo da própria página `/score` (some via Custom CSS quando isolado).
- **Query string**: `?tema=a` (default), `?tema=b`, `?tema=c` ou `?tema=d`.
- **localStorage**: a última escolha fica salva no browser, então abrir `/score?sala=XXXX` sem `tema=` reaproveita.

| Tema | Estilo                          | Quando usar                                 |
|------|---------------------------------|---------------------------------------------|
| `a`  | Premium Glass + Gradientes      | Default. Sofisticado, sem distrair.        |
| `b`  | Game Show / Show do Milhão      | Bordas neon roxo/dourado, vibe palco de TV. |
| `c`  | Minimalista Elegante            | Tipografia gigante, sem cards, Apple-like.  |
| `d`  | Esports / Dashboard Moderno     | Clip-path, monospace, accent cyan/magenta.  |

Para visualizar os 4 lado a lado antes de escolher: abra `http://localhost:7000/score-demo`.

## Dicas

- Use o botão **◐ Fundo** no canto superior direito da tela `/score` pra alternar entre fundo escuro (preview) e fundo transparente (ideal pro Browser Source).
- O snippet de CSS já força `background: transparent` — funciona mesmo se você esqueceu de clicar no toggle.
- A tela de transmissão **nunca** deve ter scroll — tudo precisa caber em 1920x1080 no modo cheio, ou no tamanho da Browser Source no modo isolado.
- Teste no OBS antes da transmissão ao vivo. Sugestão: abra `/score` numa aba, depois adicione uma Browser Source apontando pra mesma URL e ajuste o CSS até gostar.
