// ─── Tipos de jogo ───────────────────────────────────
//
// Cada tipo de tela de jogo declara as opções exibidas no formulário de
// criação de sala e os valores default usados quando o cliente não envia
// configuração. Novos tipos devem ser registrados em GAME_TYPES; o lobby
// renderiza o formulário a partir desta metadata (GET /api/game-types).

export type GameTypeId = 'buzzer-order';

export type PenaltyType = 'rounds' | 'points';

export type BuzzerOrderConfig = {
  quiz_url: string;
  total_rounds: number;
  points_exact: number;
  points_near: number;
  penalty_type: PenaltyType;
  penalty_rounds: number;
  penalty_points: number;
};

// Configuração atual do jogo, mantida como default de novos tipos de sala.
export const DEFAULT_BUZZER_ORDER_CONFIG: BuzzerOrderConfig = {
  quiz_url: '',
  total_rounds: 0,
  points_exact: 3,
  points_near: 1,
  penalty_type: 'rounds',
  penalty_rounds: 3,
  penalty_points: 3,
};

export type ConfigValue = string | number;
export type ShowWhen = { key: string; equals: ConfigValue };

type FieldBase = {
  key: string;
  label: string;
  help?: string;
  show_when?: ShowWhen;
};

export type GameConfigField =
  | (FieldBase & {
      type: 'url';
      placeholder?: string;
      // Validação específica de formato, além de http/https.
      format?: 'youtube';
      default: string;
    })
  | (FieldBase & { type: 'number'; min: number; max: number; step?: number; default: number })
  | (FieldBase & {
      type: 'select';
      options: { value: string; label: string }[];
      default: string;
    });

export type GameType = {
  id: GameTypeId;
  name: string;
  description: string;
  fields: GameConfigField[];
};

const C = DEFAULT_BUZZER_ORDER_CONFIG;

const BUZZER_ORDER_FIELDS: GameConfigField[] = [
  {
    key: 'quiz_url',
    label: 'URL do quiz no YouTube',
    type: 'url',
    format: 'youtube',
    placeholder: 'https://www.youtube.com/watch?v=...',
    default: C.quiz_url,
    help: 'Opcional. Se preencher, a URL já vem carregada no painel do apresentador.',
  },
  {
    key: 'total_rounds',
    label: 'Número de rodadas',
    type: 'number',
    min: 0,
    max: 200,
    step: 1,
    default: C.total_rounds,
    help: '0 = sem limite. Com limite, a partida termina após a última rodada.',
  },
  {
    key: 'points_exact',
    label: 'Pontuação certeira',
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
    default: C.points_exact,
    help: 'Pontos para quem acerta na mosca.',
  },
  {
    key: 'points_near',
    label: 'Pontuação quase',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    default: C.points_near,
    help: 'Pontos para quem chega perto.',
  },
  {
    key: 'penalty_type',
    label: 'Tipo de punição',
    type: 'select',
    default: C.penalty_type,
    options: [
      { value: 'rounds', label: 'Rodadas de punição' },
      { value: 'points', label: 'Subtrair pontos' },
    ],
    help: 'O que acontece quando o apresentador clica em "Errou".',
  },
  {
    key: 'penalty_rounds',
    label: 'Rodadas de punição',
    type: 'number',
    min: 1,
    max: 50,
    step: 1,
    default: C.penalty_rounds,
    show_when: { key: 'penalty_type', equals: 'rounds' },
    help: 'Quantas rodadas o jogador fica sem poder buzinar.',
  },
  {
    key: 'penalty_points',
    label: 'Pontos a subtrair',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    default: C.penalty_points,
    show_when: { key: 'penalty_type', equals: 'points' },
    help: 'Quantos pontos são retirados do placar do jogador.',
  },
];

export const GAME_TYPES: GameType[] = [
  {
    id: 'buzzer-order',
    name: 'Ordem das Buzinas',
    description:
      'Quiz em vídeo: os jogadores apertam a buzina e o apresentador pontua na ordem dos cliques.',
    fields: BUZZER_ORDER_FIELDS,
  },
];

export function getGameType(id: unknown): GameType | undefined {
  if (typeof id !== 'string') return undefined;
  return GAME_TYPES.find(t => t.id === id);
}

// Defaults de um tipo, derivados dos campos do registro (fonte única de verdade).
export function defaultConfigFor(typeId: string): BuzzerOrderConfig {
  const type = getGameType(typeId);
  const config: Record<string, ConfigValue> = { ...DEFAULT_BUZZER_ORDER_CONFIG };
  if (type) {
    for (const field of type.fields) config[field.key] = field.default;
  }
  return config as BuzzerOrderConfig;
}

export type NormalizeRoomConfigResult =
  | { ok: true; type: GameType; config: BuzzerOrderConfig }
  | { ok: false; error: string };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Mesmo formato aceito pelo player do painel (watch/shorts/embed/youtu.be).
// O host é ancorado para não aceitar URLs de outros domínios que contenham
// "youtube.com" no caminho.
const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[?&#].*)?$/i;

function isYouTubeUrl(value: string): boolean {
  return YOUTUBE_URL_PATTERN.test(value);
}

// Valida e normaliza a configuração vinda do cliente. Campos ausentes usam o
// default do tipo; campos fora do intervalo/opções são rejeitados (400).
export function normalizeRoomConfig(
  typeId: unknown,
  rawConfig: unknown,
): NormalizeRoomConfigResult {
  const type = getGameType(typeId);
  if (!type) {
    return { ok: false, error: 'Tipo de jogo inválido. Selecione uma opção da lista.' };
  }

  let input: Record<string, unknown> = {};
  if (rawConfig !== undefined && rawConfig !== null) {
    if (typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
      return { ok: false, error: 'Configuração da sala inválida.' };
    }
    input = rawConfig as Record<string, unknown>;
  }

  const config: Record<string, ConfigValue> = {};

  for (const field of type.fields) {
    const value = input[field.key];

    if (field.type === 'url') {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return { ok: false, error: `${field.label}: informe uma URL válida.` };
      }
      const url = value === undefined || value === null ? field.default : value.trim();
      if (url.length > 500) {
        return { ok: false, error: `${field.label}: use no máximo 500 caracteres.` };
      }
      if (url && field.format === 'youtube' && !isYouTubeUrl(url)) {
        return {
          ok: false,
          error: `${field.label}: informe uma URL válida do YouTube (ex.: https://www.youtube.com/watch?v=...).`,
        };
      }
      if (url && !isHttpUrl(url)) {
        return { ok: false, error: `${field.label}: informe uma URL http:// ou https:// válida.` };
      }
      config[field.key] = url;
      continue;
    }

    if (field.type === 'number') {
      if (value !== undefined && value !== null &&
          typeof value !== 'number' && typeof value !== 'string') {
        return { ok: false, error: `${field.label}: informe um número inteiro.` };
      }

      let number: number;
      if (typeof value === 'number') {
        number = value;
      } else {
        const text = value === undefined || value === null ? '' : value.trim();
        number = text === '' ? field.default : Number(text);
      }

      if (!Number.isInteger(number)) {
        return { ok: false, error: `${field.label}: informe um número inteiro.` };
      }
      if (number < field.min || number > field.max) {
        return {
          ok: false,
          error: `${field.label}: use um valor entre ${field.min} e ${field.max}.`,
        };
      }
      config[field.key] = number;
      continue;
    }

    if (value !== undefined && value !== null && typeof value !== 'string') {
      return { ok: false, error: `${field.label}: opção inválida.` };
    }
    const selected = value === undefined || value === null || value === ''
      ? field.default
      : value;
    if (!field.options.some(option => option.value === selected)) {
      return { ok: false, error: `${field.label}: opção inválida.` };
    }
    config[field.key] = selected;
  }

  return { ok: true, type, config: config as BuzzerOrderConfig };
}
