import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPncpDocumentsUrl,
  downloadPncpPdf,
  parsePncpDocuments,
  parsePncpProcurementCoordinates,
  prioritizePncpDocuments,
} from '../integrations/pncp/documents-client.ts';
import type { PncpDocumentsRepository } from '../integrations/pncp/documents-repository.ts';
import { runPncpDocumentIngestion } from '../integrations/pncp/run-documents.ts';

void test('derives the official PNCP document endpoint without trusting arbitrary hosts', () => {
  const coordinates = parsePncpProcurementCoordinates(
    'https://pncp.gov.br/app/editais/01599409000139/2026/23',
  );
  assert.deepEqual(coordinates, {
    cnpj: '01599409000139',
    year: 2026,
    sequence: 23,
  });
  assert.equal(
    buildPncpDocumentsUrl(coordinates!).toString(),
    'https://pncp.gov.br/api/pncp/v1/orgaos/01599409000139/compras/2026/23/arquivos?pagina=1&tamanhoPagina=50',
  );
  assert.equal(
    parsePncpProcurementCoordinates(
      'https://example.com/not-an-official-source',
      '01599409000139-1-000023/2026',
    )?.sequence,
    23,
  );
});

void test('keeps active official metadata and prioritizes terms and notices', () => {
  const parsed = parsePncpDocuments([
    {
      url: 'https://pncp.gov.br/pncp-api/v1/orgaos/1/compras/2/3/arquivos/1',
      statusAtivo: true,
      sequencialDocumento: 1,
      titulo: 'Documento auxiliar',
      tipoDocumentoNome: 'Outros Documentos',
    },
    {
      url: 'https://pncp.gov.br/pncp-api/v1/orgaos/1/compras/2/3/arquivos/2',
      statusAtivo: true,
      sequencialDocumento: 2,
      titulo: 'Termo de Referência',
      tipoDocumentoNome: 'Termo de Referência',
      dataPublicacaoPncp: '2026-09-11T10:00:00',
    },
    {
      url: 'https://pncp.gov.br/ignored',
      statusAtivo: false,
      sequencialDocumento: 3,
    },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(prioritizePncpDocuments(parsed, 1)[0]?.sequence, 2);
  assert.equal(parsed[1]?.publishedAt, '2026-09-11T13:00:00.000Z');
});

void test('rejects a document URL outside the PNCP before requesting it', async () => {
  let requested = false;
  await assert.rejects(
    downloadPncpPdf('https://example.com/file.pdf', {
      fetcher: async () => {
        requested = true;
        return new Response();
      },
    }),
    /pncp_document_host_not_allowed/,
  );
  assert.equal(requested, false);
});

void test('ingests a new immutable PDF version and reuses its hash', async () => {
  const checked: string[] = [];
  let known = false;
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
    async findVersion() {
      return known ? { id: 'document-1', storagePath: 'stored.pdf' } : null;
    },
    async verifyExisting() {
      throw new Error('should_not_verify_a_new_version');
    },
    async registerVersion() {
      known = true;
      return {
        documentId: 'document-1',
        changeType: 'document_added' as const,
      };
    },
    async markChecked(id: string) {
      checked.push(id);
    },
  } as PncpDocumentsRepository;
  const result = await runPncpDocumentIngestion({
    repository,
    fetchMetadata: async () => [
      {
        url: 'https://pncp.gov.br/pncp-api/document.pdf',
        title: 'Termo de referência',
        documentType: 'Termo de Referência',
        publishedAt: null,
        sequence: 1,
      },
    ],
    download: async () => new TextEncoder().encode('%PDF-test'),
    sleep: async () => undefined,
    now: () => new Date('2026-09-11T15:00:00Z'),
  });
  assert.deepEqual(result, {
    procurementsScanned: 1,
    documentsAttempted: 1,
    documentsFetched: 1,
    added: 1,
    changed: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
    errorCodes: [],
  });
  assert.deepEqual(checked, ['procurement-1']);
});
