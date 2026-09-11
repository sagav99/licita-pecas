import { collectPncpPages, type PncpCollection } from './client.ts';
import type { PersistenceSummary, PncpRepository } from './repository.ts';

export type PncpRunSummary = PersistenceSummary & {
  skipped: boolean;
  fetched: number;
  pagesFetched: number;
  truncated: boolean;
};

function errorCode(error: unknown) {
  return error instanceof Error ? error.message.split(':')[0] : 'unknown_error';
}

export async function runPncpCollection(input: {
  repository: PncpRepository;
  startDate: string;
  endDate: string;
  modalityCodes: number[];
  collect?: typeof collectPncpPages;
  maxPages?: number;
  baseUrl?: string;
  candidateFilter?: (record: PncpCollection['records'][number]) => boolean;
}): Promise<PncpRunSummary> {
  if (!input.modalityCodes.length) throw new Error('pncp_modalities_missing');
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
  const collect = input.collect ?? collectPncpPages;
  try {
    const collections: PncpCollection[] = [];
    for (const modalityCode of input.modalityCodes) {
      collections.push(
        await collect(
          {
            startDate: input.startDate,
            endDate: input.endDate,
            modalityCode,
            pageSize: 50,
          },
          { maxPages: input.maxPages ?? 20, baseUrl: input.baseUrl },
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

export function brasiliaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '');
}
