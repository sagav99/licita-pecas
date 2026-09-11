/**
 * Chaves determinísticas para idempotência da ingestão e dos alertas.
 * O adapter de persistência deve aplicar estas chaves em índices únicos.
 */
export function procurementDedupeKey(sourceId: string, externalId: string) {
  return `procurement:${normalizePart(sourceId)}:${normalizePart(externalId)}`;
}

export function documentDedupeKey(procurementId: string, contentHash: string) {
  return `document:${normalizePart(procurementId)}:${normalizePart(contentHash)}`;
}

export function alertDedupeKey(
  organizationId: string,
  procurementId: string,
  type: string,
  version = 'current',
) {
  return ['alert', organizationId, procurementId, type, version]
    .map(normalizePart)
    .join(':');
}

function normalizePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, '_');
}
