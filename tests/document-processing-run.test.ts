import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentProcessingRepository } from '../integrations/documents/processing-repository.ts';
import { runDocumentProcessing } from '../integrations/documents/run-processing.ts';

const structured = {
  agency: 'Prefeitura de Exemplo',
  municipality: 'Exemplo',
  state: 'SP',
  object: 'Aquisição de filtros',
  modality: 'Pregão',
  sessionAt: null,
  deadlineAt: null,
  totalValue: null,
  brands: [],
  oemCodes: ['ABC-123'],
  applications: ['Caminhão'],
  deliveryRequirements: [],
  fieldStatus: { object: 'confirmado' as const },
  evidence: [
    {
      quote: 'Aquisição de filtros automotivos',
      page: 1,
      sourceUrl: 'https://pncp.gov.br/document.pdf',
    },
  ],
};

void test('persists native text before completing structured evidence', async () => {
  const events: string[] = [];
  const repository = {
    async listPending() {
      return [
        {
          id: 'document-1',
          sourceUrl: 'https://pncp.gov.br/document.pdf',
          storagePath: 'procurement/hash.pdf',
          extractedText: null,
          extractionStatus: 'pending' as const,
          processingAttempts: 0,
        },
      ];
    },
    async download() {
      events.push('download');
      return new Uint8Array([1]);
    },
    async saveText() {
      events.push('text');
    },
    async complete(_id, result, method, attempts) {
      assert.equal(result.oemCodes[0], 'ABC-123');
      assert.equal(method, 'native_text');
      assert.equal(attempts, 1);
      events.push('complete');
    },
    async fail() {
      throw new Error('should_not_fail');
    },
  } as DocumentProcessingRepository;
  const result = await runDocumentProcessing({
    repository,
    reader: {
      async readNative() {
        return 'Texto nativo suficiente do termo de referência.';
      },
      async readOcr() {
        throw new Error('ocr_should_not_run');
      },
    },
    extractor: {
      async extract() {
        return structured;
      },
    },
  });
  assert.deepEqual(events, ['download', 'text', 'complete']);
  assert.deepEqual(result, {
    attempted: 1,
    completed: 1,
    failed: 0,
    errorCodes: [],
  });
});

void test('reuses preserved OCR text and records a bounded Gemini failure', async () => {
  let failedWith: unknown[] = [];
  const repository = {
    async listPending() {
      return [
        {
          id: 'document-2',
          sourceUrl: 'https://pncp.gov.br/document.pdf',
          storagePath: 'procurement/hash.pdf',
          extractedText: 'Texto OCR previamente preservado.',
          extractionStatus: 'ocr' as const,
          processingAttempts: 1,
        },
      ];
    },
    async download() {
      throw new Error('should_not_download_again');
    },
    async saveText() {
      throw new Error('should_not_save_again');
    },
    async complete() {
      throw new Error('should_not_complete');
    },
    async fail(...args: unknown[]) {
      failedWith = args;
    },
  } as DocumentProcessingRepository;
  await assert.rejects(
    runDocumentProcessing({
      repository,
      reader: {
        async readNative() {
          return '';
        },
        async readOcr() {
          return '';
        },
      },
      extractor: {
        async extract() {
          throw new Error('gemini_quota_exhausted:details_not_persisted');
        },
      },
    }),
    /document_processing_all_failed:gemini_quota_exhausted/,
  );
  assert.deepEqual(failedWith, [
    'document-2',
    'gemini_quota_exhausted',
    2,
    'ocr',
  ]);
});
