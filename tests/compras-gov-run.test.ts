import assert from 'node:assert/strict';
import test from 'node:test';
import {
  comprasGovDate,
  runComprasGovCollection,
} from '../integrations/compras-gov/run-collection.ts';

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

void test('filters complementary records before persistence', async () => {
  const repo = repository();
  const result = await runComprasGovCollection({
    repository: repo.value,
    startDate: '2026-09-11',
    endDate: '2026-09-11',
    modalityCodes: [5, 6],
    collect: async ({ modalityCode }) => ({
      records: [
        {
          externalId: `purchase-${modalityCode}`,
          agency: 'Órgão',
          municipality: null,
          state: 'SP',
          modality: String(modalityCode),
          status: 'aberta',
          object:
            modalityCode === 6
              ? 'Aquisição de filtros automotivos'
              : 'Software',
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
    candidateFilter: (item) => item.object.includes('filtros'),
  });
  assert.equal(result.fetched, 1);
  assert.deepEqual(repo.calls, ['claim', 'persist:1', 'succeed']);
});

void test('isolates failure health and formats the Brasilia date', async () => {
  const repo = repository();
  await assert.rejects(
    runComprasGovCollection({
      repository: repo.value,
      startDate: '2026-09-11',
      endDate: '2026-09-11',
      modalityCodes: [6],
      collect: async () => {
        throw new Error('compras_gov_http_503:temporary');
      },
    }),
    /compras_gov_http_503/,
  );
  assert.deepEqual(repo.calls, ['claim', 'fail:compras_gov_http_503']);
  assert.equal(comprasGovDate(new Date('2026-09-12T01:30:00Z')), '2026-09-11');
});
