import { calculateMatch } from './catalog.ts';

export type Vertical = 'licita-pecas' | 'licita-epi' | 'licita-agua';

export type MatchSignals = {
  technical: number;
  volume: number;
  locality: number;
  deadline: number;
  requirements: number;
  hardBlock?: string;
  enoughData?: boolean;
  missing?: string[];
  positiveReasons?: string[];
};

export type MatchDecision = ReturnType<typeof calculateMatch> & {
  vertical: Vertical;
  reasons: string[];
  missing: string[];
};

const verticalLabels: Record<Vertical, string[]> = {
  'licita-pecas': ['OEM', 'aplicação', 'veículo/máquina', 'marca'],
  'licita-epi': ['CA', 'norma', 'tamanho', 'classe de risco'],
  'licita-agua': ['concentração', 'embalagem', 'laudo', 'rota logística'],
};

export function evaluateMatch(
  vertical: Vertical,
  signals: MatchSignals,
): MatchDecision {
  const missing = signals.missing ?? [];
  const reasons = [...(signals.positiveReasons ?? [])];
  if (signals.hardBlock) reasons.push(`Bloqueio: ${signals.hardBlock}`);
  const result = calculateMatch({
    technical: clamp(signals.technical),
    volume: clamp(signals.volume),
    locality: clamp(signals.locality),
    deadline: clamp(signals.deadline),
    requirements: clamp(signals.requirements),
    hardBlock: Boolean(signals.hardBlock),
    enoughData: signals.enoughData ?? missing.length === 0,
  });
  if (result.status === 'sem dados suficientes' && missing.length === 0)
    missing.push(...verticalLabels[vertical].slice(0, 2));
  return { ...result, vertical, reasons, missing };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
