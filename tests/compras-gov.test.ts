import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildComprasGovSearchUrl,
  collectComprasGovPages,
  fetchComprasGovPage,
  parseComprasGovPage,
} from '../integrations/compras-gov/client.ts';

const record = {
  numeroControlePNCP: '08993917000146-1-000214/2026',
  orgaoEntidadeRazaoSocial: 'MUNICIPIO DE CAMPINA GRANDE',
  unidadeOrgaoUfSigla: 'PB',
  unidadeOrgaoMunicipioNome: 'CAMPINA GRANDE',
  modalidadeNome: 'Dispensa',
  situacaoCompraNomePncp: 'Divulgada no PNCP',
  objetoCompra: 'Aquisição de lubrificantes e insumos automotivos',
  valorTotalEstimado: 34602,
  dataPublicacaoPncp: '2026-09-10T01:00:32',
  dataEncerramentoPropostaPncp: '2026-09-16T08:00:00',
  contratacaoExcluida: false,
};

void test('builds the bounded official Compras.gov.br query', () => {
  const url = buildComprasGovSearchUrl({
    startDate: '2026-09-10',
    endDate: '2026-09-11',
    modalityCode: 6,
    page: 2,
    pageSize: 50,
  });
  assert.equal(url.hostname, 'dadosabertos.compras.gov.br');
  assert.equal(url.searchParams.get('pagina'), '2');
  assert.equal(url.searchParams.get('dataPublicacaoPncpInicial'), '2026-09-10');
  assert.equal(url.searchParams.get('codigoModalidade'), '6');
  assert.throws(
    () =>
      buildComprasGovSearchUrl({
        startDate: '20260910',
        endDate: '2026-09-11',
        modalityCode: 6,
      }),
    /start_date_must_be_yyyy_mm_dd/,
  );
});

void test('normalizes evidence fields and drops excluded purchases', () => {
  const page = parseComprasGovPage({
    resultado: [
      record,
      { ...record, contratacaoExcluida: true },
      { ...record, numeroControlePNCP: 'invalid' },
    ],
    totalPaginas: 1,
    paginasRestantes: 0,
  });
  assert.equal(page.records.length, 1);
  assert.deepEqual(page.records[0], {
    externalId: '08993917000146-1-000214/2026',
    agency: 'MUNICIPIO DE CAMPINA GRANDE',
    municipality: 'CAMPINA GRANDE',
    state: 'PB',
    modality: 'Dispensa',
    status: 'Divulgada no PNCP',
    object: 'Aquisição de lubrificantes e insumos automotivos',
    publishedAt: '2026-09-10T04:00:32.000Z',
    sessionAt: null,
    deadlineAt: '2026-09-16T11:00:00.000Z',
    totalValue: 34602,
    sourceUrl: 'https://pncp.gov.br/app/editais/08993917000146/2026/214',
  });
});

void test('paginates with a cap and deduplicates the PNCP control number', async () => {
  const collection = await collectComprasGovPages(
    {
      startDate: '2026-09-10',
      endDate: '2026-09-11',
      modalityCode: 6,
    },
    {
      maxPages: 2,
      fetchPage: async (search) => ({
        records: parseComprasGovPage({
          resultado: [record],
          totalPaginas: 3,
          paginasRestantes: 3 - (search.page ?? 1),
        }).records,
        page: search.page ?? 1,
        totalPages: 3,
        remainingPages: 3 - (search.page ?? 1),
      }),
    },
  );
  assert.equal(collection.records.length, 1);
  assert.equal(collection.pagesFetched, 2);
  assert.equal(collection.truncated, true);
});

void test('retries temporary source failures with a bounded delay', async () => {
  let calls = 0;
  const delays: number[] = [];
  const page = await fetchComprasGovPage(
    {
      startDate: '2026-09-10',
      endDate: '2026-09-11',
      modalityCode: 6,
    },
    {
      fetcher: async () => {
        calls += 1;
        return calls === 1
          ? new Response('', { status: 503 })
          : Response.json({
              resultado: [record],
              totalPaginas: 1,
              paginasRestantes: 0,
            });
      },
      sleep: async (delay) => {
        delays.push(delay);
      },
    },
  );
  assert.equal(page.records.length, 1);
  assert.deepEqual(delays, [2000]);
});
