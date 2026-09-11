import { documentDedupeKey, procurementDedupeKey } from './dedupe.ts';

export type ProcurementSnapshot = {
  sourceId: string;
  externalId: string;
  agency?: string;
  municipality?: string | null;
  state?: string | null;
  modality?: string | null;
  status?: string;
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

export type ProcurementChangeEvent = {
  type: 'procurement_changed';
  changedFields: ReturnType<typeof changedProcurementFields>;
  previousHash: string;
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
    'agency',
    'municipality',
    'state',
    'modality',
    'status',
    'sourceUrl',
    'object',
    'publishedAt',
    'sessionAt',
    'deadlineAt',
    'totalValue',
  ] as const;
  return fields.filter((field) => previous[field] !== current[field]);
}

export async function buildProcurementChangeEvent(
  procurementId: string,
  previous: ProcurementSnapshot,
  current: ProcurementSnapshot,
): Promise<ProcurementChangeEvent | null> {
  const changedFields = changedProcurementFields(previous, current);
  if (!changedFields.length) return null;
  const [previousHash, currentHash] = await Promise.all([
    snapshotHash(previous),
    snapshotHash(current),
  ]);
  return {
    type: 'procurement_changed',
    changedFields,
    previousHash,
    currentHash,
    dedupeKey: `procurement-change:${procurementId}:${currentHash}`,
  };
}

async function snapshotHash(snapshot: ProcurementSnapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
