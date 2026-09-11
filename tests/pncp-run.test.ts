import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brasiliaDate,
  runPncpCollection,
} from '../integrations/pncp/run-collection.ts';

function repository(options: { claimed?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    value: {
      async claim() {
        calls.push('claim');
        return options.claimed ?? true;
      },
      async persist(records: unknown[]) {
        calls.push(`persist:${records.length}`);
        return {
          inserted: records.length,
          updated: 0,
          unchanged: 0,
          changeEvents: 0,
        };
      },
      async succeed() {
        calls.push('succeed');
      },
      async fail(code: string) {
        calls.push(`fail:${code}`);
      },
    },
  };
}

void test('collects modalities, deduplicates and records source success', async () => {
  const repo = repository();
  const result = await runPncpCollection({
    repository: repo.value,
    startDate: '20260911',
    endDate: '20260911',
    modalityCodes: [6, 8],
    collect: async ({ modalityCode }) => ({
      records: [
        {
          externalId: 'same-id',
          agency: 'Órgão',
          municipality: null,
          state: 'SP',
          modality: String(modalityCode),
          status: 'aberta',
          object: 'Peças',
          publishedAt: null,
          sessionAt: null,
          deadlineAt: null,
          totalValue: null,
          sourceUrl: 'https://pncp.gov.br/app/editais/exemplo',
        },
      ],
      pagesFetched: 1,
      totalPages: 1,
      truncated: false,
    }),
  });
  assert.equal(result.fetched, 1);
  assert.equal(result.pagesFetched, 2);
  assert.deepEqual(repo.calls, ['claim', 'persist:1', 'succeed']);
});

void test('skips a concurrent run and records a bounded error code', async () => {
  const busy = repository({ claimed: false });
  assert.equal(
    (
      await runPncpCollection({
        repository: busy.value,
        startDate: '20260911',
        endDate: '20260911',
        modalityCodes: [6],
      })
    ).skipped,
    true,
  );

  const failing = repository();
  await assert.rejects(
    runPncpCollection({
      repository: failing.value,
      startDate: '20260911',
      endDate: '20260911',
      modalityCodes: [6],
      collect: async () => {
        throw new Error('pncp_http_503:temporary');
      },
    }),
    /pncp_http_503/,
  );
  assert.deepEqual(failing.calls, ['claim', 'fail:pncp_http_503']);
});

void test('formats collection dates in Brasilia regardless of server timezone', () => {
  assert.equal(brasiliaDate(new Date('2026-09-12T01:30:00Z')), '20260911');
});
