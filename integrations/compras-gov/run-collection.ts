import { collectComprasGovPages, type ComprasGovCollection } from './client.ts';
import type { ComprasGovRepository } from './repository.ts';
import type { PersistenceSummary } from '../pncp/repository.ts';

export type ComprasGovRunSummary = PersistenceSummary & {
  skipped: boolean;
  fetched: number;
  pagesFetched: number;
  truncated: boolean;
};

function errorCode(error: unknown) {
  return error instanceof Error ? error.message.split(':')[0] : 'unknown_error';
}

export async function runComprasGovCollection(input: {
  repository: ComprasGovRepository;
  startDate: string;
  endDate: string;
  modalityCodes: number[];
  collect?: typeof collectComprasGovPages;
  maxPages?: number;
  baseUrl?: string;
  candidateFilter?: (
    record: ComprasGovCollection['records'][number],
  ) => boolean;
}): Promise<ComprasGovRunSummary> {
  if (!input.modalityCodes.length)
    throw new Error('compras_gov_modalities_missing');
  const claimed = await input.repository.claim();
  if (!claimed) {
    return {
      skipped: true,
      fetched: 0,
      pagesFetched: 0,
      truncated: false,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      changeEvents: 0,
    };
  }
  const collect = input.collect ?? collectComprasGovPages;
  try {
    const collections: ComprasGovCollection[] = [];
    for (const modalityCode of input.modalityCodes) {
      collections.push(
        await collect(
          {
            startDate: input.startDate,
            endDate: input.endDate,
            modalityCode,
            pageSize: 50,
          },
          { maxPages: input.maxPages ?? 10, baseUrl: input.baseUrl },
        ),
      );
    }
    const discovered = [
      ...new Map(
        collections
          .flatMap((collection) => collection.records)
          .map((record) => [record.externalId, record]),
      ).values(),
    ];
    const records = input.candidateFilter
      ? discovered.filter(input.candidateFilter)
      : discovered;
    const persisted = await input.repository.persist(records);
    await input.repository.succeed();
    return {
      ...persisted,
      skipped: false,
      fetched: records.length,
      pagesFetched: collections.reduce(
        (total, collection) => total + collection.pagesFetched,
        0,
      ),
      truncated: collections.some((collection) => collection.truncated),
    };
  } catch (error) {
    await input.repository.fail(errorCode(error));
    throw error;
  }
}

export function comprasGovDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
