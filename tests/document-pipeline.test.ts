import assert from 'node:assert/strict';
import test from 'node:test';
import { processProcurementDocument } from '../integrations/documents/process-document.ts';
import { assertPdf } from '../integrations/documents/pdf-reader.ts';

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
      sourceUrl: 'https://example.com/edital.pdf',
    },
  ],
};

void test('passes extracted text and official URL to structured extraction', async () => {
  const calls: Array<{ sourceUrl: string; text: string }> = [];
  const result = await processProcurementDocument({
    bytes: new Uint8Array([1]),
    sourceUrl: 'https://example.com/edital.pdf',
    reader: {
      async readNative() {
        return 'Texto nativo suficiente do edital. Aquisição de filtros automotivos.';
      },
      async readOcr() {
        throw new Error('ocr_should_not_run');
      },
    },
    extractor: {
      async extract(input) {
        calls.push(input);
        return structured;
      },
    },
  });
  assert.equal(result.read.method, 'native');
  assert.equal(result.structured.oemCodes[0], 'ABC-123');
  assert.deepEqual(calls, [
    {
      sourceUrl: 'https://example.com/edital.pdf',
      text: 'Texto nativo suficiente do edital. Aquisição de filtros automotivos.',
      scope: 'full',
    },
  ]);
});

void test('rejects non-PDF bytes before native extraction or OCR', () => {
  assert.throws(() => assertPdf(new TextEncoder().encode('not a pdf')), {
    message: 'document_not_pdf',
  });
});
