import { documentDedupeKey, procurementDedupeKey } from './dedupe.ts';

export type ProcurementSnapshot = {
  sourceId: string;
  externalId: string;
  sourceUrl: string;
  object: string;
  publishedAt: string | null;
  sessionAt: string | null;
  deadlineAt: string | null;
  totalValue: number | null;
};

export type DocumentChange = 'created' | 'unchanged' | 'changed';

export type SourceEvent = {
  type: 'document_added' | 'document_changed';
  previousHash: string | null;
  currentHash: string;
  dedupeKey: string;
};

export function procurementKey(snapshot: ProcurementSnapshot) {
  return procurementDedupeKey(snapshot.sourceId, snapshot.externalId);
}

export function compareDocumentHash(
  previousHash: string | null,
  currentHash: string,
): DocumentChange {
  if (!previousHash) return 'created';
  return previousHash === currentHash ? 'unchanged' : 'changed';
}

export function buildSourceEvent(
  procurementId: string,
  previousHash: string | null,
  currentHash: string,
): SourceEvent | null {
  const change = compareDocumentHash(previousHash, currentHash);
  if (change === 'unchanged') return null;
  return {
    type: change === 'created' ? 'document_added' : 'document_changed',
    previousHash,
    currentHash,
    dedupeKey: documentDedupeKey(procurementId, currentHash),
  };
}

/**
 * Detecta mudança relevante sem decidir persistência. O repositório deve
 * executar a gravação em transação e preservar a versão anterior.
 */
export function changedProcurementFields(
  previous: ProcurementSnapshot,
  current: ProcurementSnapshot,
) {
  const fields = [
    'sourceUrl',
    'object',
    'publishedAt',
    'sessionAt',
    'deadlineAt',
    'totalValue',
  ] as const;
  return fields.filter((field) => previous[field] !== current[field]);
}
