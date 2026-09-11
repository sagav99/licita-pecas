import {
  decideAlert,
  isWithinDeadline,
  type AlertCandidate,
  type AlertPreferences,
  type AlertType,
} from './alerts.ts';

export type MatchAlertStatus =
  | 'compatível'
  | 'revisar'
  | 'incompatível'
  | 'sem dados suficientes';

export type AlertContext = {
  organizationId: string;
  procurementId: string;
  sourceUrl: string;
  currentMatchStatus: MatchAlertStatus;
  previousMatchStatus?: MatchAlertStatus;
  documentChange?: {
    kind: 'document_added' | 'document_changed';
    currentHash: string;
  };
  deadlineAt?: string | null;
  workflow?: 'avaliando' | 'vai disputar' | 'não atende' | 'perdida';
};

export type PlannedAlert = AlertCandidate & {
  sourceUrl: string;
  dedupeKey: string;
  reason: string;
};

/**
 * Converte fatos do domínio em candidatos; envio e persistência pertencem aos
 * adapters externos. Cada versão produz uma chave estável para reprocessamento.
 */
export function buildAlertCandidates(
  context: AlertContext,
  now: Date,
): Array<AlertCandidate & { sourceUrl: string; reason: string }> {
  const base = {
    organizationId: context.organizationId,
    procurementId: context.procurementId,
    sourceUrl: context.sourceUrl,
  };
  const candidates: Array<
    AlertCandidate & { sourceUrl: string; reason: string }
  > = [];

  if (
    context.previousMatchStatus === undefined &&
    context.currentMatchStatus === 'compatível'
  ) {
    candidates.push({
      ...base,
      type: 'new_match',
      version: 'initial-compatible',
      reason: 'Novo edital classificado como compatível.',
    });
  }

  if (
    context.previousMatchStatus !== undefined &&
    context.previousMatchStatus !== context.currentMatchStatus &&
    ['compatível', 'revisar'].includes(context.currentMatchStatus)
  ) {
    candidates.push({
      ...base,
      type: 'item_reclassified',
      version: `${context.previousMatchStatus}-${context.currentMatchStatus}`,
      reason: `Classificação alterada de ${context.previousMatchStatus} para ${context.currentMatchStatus}.`,
    });
  }

  if (context.documentChange?.kind === 'document_changed') {
    candidates.push({
      ...base,
      type: 'procurement_changed',
      version: context.documentChange.currentHash,
      reason: 'O documento oficial foi alterado após a coleta anterior.',
    });
  }

  if (
    context.deadlineAt &&
    context.workflow !== 'não atende' &&
    context.workflow !== 'perdida'
  ) {
    const deadline = new Date(context.deadlineAt);
    if (!Number.isNaN(deadline.getTime()) && isWithinDeadline(deadline, now)) {
      candidates.push({
        ...base,
        type: 'deadline_near',
        version: context.deadlineAt,
        reason: 'A sessão ou o prazo ocorrerá nas próximas 48 horas.',
      });
    }
  }

  return candidates;
}

export function planAlerts(
  context: AlertContext,
  preferences: AlertPreferences,
  now: Date,
): PlannedAlert[] {
  return buildAlertCandidates(context, now).flatMap((candidate) => {
    const decision = decideAlert(candidate, preferences);
    if (!decision.send) return [];
    return [{ ...candidate, dedupeKey: decision.dedupeKey }];
  });
}

export function defaultAlertTypes(): AlertType[] {
  return [
    'new_match',
    'procurement_changed',
    'deadline_near',
    'item_reclassified',
  ];
}
