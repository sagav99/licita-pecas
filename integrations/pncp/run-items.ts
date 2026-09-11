import { parsePncpProcurementCoordinates } from './documents-client.ts';
import { fetchPncpItems, procurementItemsHash } from './items-client.ts';
import type { PncpItemsRepository } from './items-repository.ts';

function safeErrorCode(error: unknown) {
  return error instanceof Error
    ? error.message.split(':')[0].slice(0, 120)
    : 'unknown_error';
}

export async function runPncpItemsIngestion(input: {
  repository: PncpItemsRepository;
  limit?: number;
  fetchItems?: typeof fetchPncpItems;
  now?: () => Date;
}) {
  const limit = input.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new Error('invalid_item_ingestion_limit');
  const candidates = await input.repository.listCandidates(limit);
  const fetchItems = input.fetchItems ?? fetchPncpItems;
  const now = input.now ?? (() => new Date());
  const summary = {
    procurementsScanned: 0,
    items: 0,
    added: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
    errorCodes: [] as string[],
  };
  for (const candidate of candidates) {
    const coordinates = parsePncpProcurementCoordinates(
      candidate.sourceUrl,
      candidate.externalId,
    );
    if (!coordinates) {
      summary.skipped += 1;
      await input.repository.markChecked(candidate.id, now().toISOString());
      continue;
    }
    try {
      const items = await fetchItems(coordinates);
      const result = await input.repository.persist(
        candidate.id,
        items,
        await procurementItemsHash(items),
        now().toISOString(),
      );
      summary.procurementsScanned += 1;
      summary.items += result.itemCount;
      if (result.changeType === 'items_added') summary.added += 1;
      else if (result.changeType === 'items_changed') summary.changed += 1;
      else summary.unchanged += 1;
    } catch (error) {
      summary.failed += 1;
      const code = safeErrorCode(error);
      if (!summary.errorCodes.includes(code)) summary.errorCodes.push(code);
    }
  }
  if (candidates.length > 0 && summary.procurementsScanned === 0)
    throw new Error(`pncp_items_all_failed:${summary.errorCodes.join(',')}`);
  return summary;
}
