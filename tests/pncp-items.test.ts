import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPncpItemsUrl,
  fetchPncpItems,
  parsePncpItems,
  procurementItemsHash,
} from '../integrations/pncp/items-client.ts';
import type { PncpItemsRepository } from '../integrations/pncp/items-repository.ts';
import { runPncpItemsIngestion } from '../integrations/pncp/run-items.ts';

const coordinates = { cnpj: '01599409000139', year: 2026, sequence: 23 };

void test('parses structured PNCP item quantities, codes and requirements', () => {
  const [item] = parsePncpItems([
    {
      numeroItem: 1,
      descricao: 'Filtro de óleo diesel OEM ABC-123',
      materialOuServicoNome: 'Material',
      valorUnitarioEstimado: 120.5,
      valorTotal: 1205,
      quantidade: 10,
      unidadeMedida: 'UNIDADE',
      ncmNbsCodigo: '84212300',
      catalogoCodigoItem: 'ABC-123',
      informacaoComplementar: 'Aplicação em caminhão',
      situacaoCompraItemNome: 'Em andamento',
    },
  ]);
  assert.equal(item?.externalId, '1');
  assert.deepEqual(item?.codes, ['84212300', 'ABC-123']);
  assert.equal(item?.quantity, 10);
  assert.equal(item?.technicalRequirements.unitValue, 120.5);
});

void test('paginates official items with a bounded endpoint', async () => {
  const pages: number[] = [];
  const items = await fetchPncpItems(coordinates, {
    fetcher: async (request) => {
      const requestUrl =
        request instanceof URL
          ? request
          : new URL(typeof request === 'string' ? request : request.url);
      const page = Number(requestUrl.searchParams.get('pagina'));
      pages.push(page);
      return Response.json(
        page === 1
          ? Array.from({ length: 50 }, (_, index) => ({
              numeroItem: index + 1,
              descricao: `Item ${index + 1}`,
            }))
          : [{ numeroItem: 51, descricao: 'Item 51' }],
      );
    },
    sleep: async () => undefined,
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(items.length, 51);
  assert.match(buildPncpItemsUrl(coordinates).pathname, /\/itens$/);
  assert.equal((await procurementItemsHash(items)).length, 64);
});

void test('persists one idempotent item snapshot per procurement', async () => {
  let persistedHash = '';
  const repository = {
    async listCandidates() {
      return [
        {
          id: 'procurement-1',
          externalId: '01599409000139-1-000023/2026',
          sourceUrl: 'https://pncp.gov.br/app/editais/01599409000139/2026/23',
        },
      ];
    },
    async persist(_id, items, hash) {
      persistedHash = hash;
      return { changeType: 'items_added' as const, itemCount: items.length };
    },
    async markChecked() {
      throw new Error('should_not_mark_success_outside_transaction');
    },
  } as PncpItemsRepository;
  const result = await runPncpItemsIngestion({
    repository,
    fetchItems: async () => [
      {
        externalId: '1',
        description: 'Filtro de óleo',
        codes: ['ABC-123'],
        quantity: 2,
        unit: 'UN',
        technicalRequirements: {
          materialOrService: 'Material',
          category: null,
          unitValue: null,
          totalValue: null,
          additionalInformation: null,
          status: 'Em andamento',
        },
      },
    ],
    now: () => new Date('2026-09-11T15:00:00Z'),
  });
  assert.equal(persistedHash.length, 64);
  assert.deepEqual(result, {
    procurementsScanned: 1,
    items: 1,
    added: 1,
    changed: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
    errorCodes: [],
  });
});
