import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildPncpSearchUrl,
  collectPncpPages,
  parsePncpPage,
} from '../integrations/pncp/client.ts';
import { nextSourceHealth } from '../integrations/sources/health.ts';

void test('builds a bounded PNCP publication search', () => {
  const url = buildPncpSearchUrl({
    startDate: '20260909',
    endDate: '20260910',
    modalityCode: 6,
    page: 2,
    pageSize: 25,
  });
  assert.equal(url.hostname, 'pncp.gov.br');
  assert.equal(url.searchParams.get('pagina'), '2');
  assert.equal(url.searchParams.get('tamanhoPagina'), '25');
});

void test('normalizes PNCP data and drops records without required proof fields', () => {
  const result = parsePncpPage({
    numeroPagina: 1,
    totalPaginas: 2,
    paginasRestantes: 1,
    data: [
      {
        numeroControlePNCP: '12345678000199-1-000014/2026',
        anoCompra: 2026,
        sequencialCompra: 14,
        objetoCompra: 'Aquisição de filtros automotivos',
        modalidadeNome: 'Pregão eletrônico',
        situacaoCompraNome: 'Divulgada no PNCP',
        valorTotalEstimado: 84730,
        dataPublicacaoPncp: '2026-09-10T08:00:00',
        dataEncerramentoProposta: '2026-09-12T09:00:00',
        orgaoEntidade: {
          cnpj: '12345678000199',
          razaoSocial: 'Prefeitura Municipal de Exemplo',
        },
        unidadeOrgao: { municipioNome: 'Exemplo', ufSigla: 'SP' },
      },
      { objetoCompra: 'Registro incompleto' },
    ],
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].state, 'SP');
  assert.equal(
    result.records[0].sourceUrl,
    'https://pncp.gov.br/app/editais/12345678000199/2026/14',
  );
});

void test('keeps the PNCP fixture compatible with the normalized contract', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/pncp-page-1.json', import.meta.url),
      'utf8',
    ),
  );
  const result = parsePncpPage(fixture);
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 2);
  assert.equal(result.records[0]?.externalId, '12345678000199-1-000014/2026');
});

void test('collects bounded pages and deduplicates repeated procurements', async () => {
  const calls: number[] = [];
  const result = await collectPncpPages(
    {
      startDate: '20260909',
      endDate: '20260910',
      modalityCode: 6,
    },
    {
      maxPages: 2,
      fetchPage: async (search) => {
        const page = search.page ?? 1;
        calls.push(page);
        return {
          page,
          totalPages: 3,
          remainingPages: 3 - page,
          records: [
            {
              externalId: page === 2 ? 'edital-1' : `edital-${page}`,
              agency: 'Órgão de teste',
              municipality: 'Exemplo',
              state: 'SP',
              modality: 'Pregão eletrônico',
              status: 'aberto',
              object: 'Aquisição de peças',
              publishedAt: null,
              sessionAt: null,
              deadlineAt: null,
              totalValue: null,
              sourceUrl: 'https://pncp.gov.br/app/editais/exemplo',
            },
          ],
        };
      },
    },
  );

  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.records.length, 1);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.truncated, true);
});

void test('rejects invalid ranges before calling the PNCP', () => {
  assert.throws(
    () =>
      buildPncpSearchUrl({
        startDate: '20260911',
        endDate: '20260910',
        modalityCode: 6,
      }),
    /invalid_date_range/,
  );
});

void test('pauses unstable complementary sources with capped backoff', () => {
  assert.deepEqual(nextSourceHealth(2), {
    status: 'degraded',
    retryAfterMinutes: 30,
  });
  assert.deepEqual(nextSourceHealth(8), {
    status: 'paused',
    retryAfterMinutes: 1440,
  });
});
