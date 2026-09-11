import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDocumentText } from '../integrations/documents/extractor.ts';

void test('prefers native PDF text and avoids unnecessary OCR', async () => {
  let ocrCalls = 0;
  const result = await extractDocumentText(new Uint8Array([1]), {
    async readNative() {
      return 'Texto nativo suficiente para análise do edital.';
    },
    async readOcr() {
      ocrCalls++;
      return 'ocr';
    },
  });
  assert.equal(result.method, 'native');
  assert.equal(ocrCalls, 0);
});

void test('falls back to OCR only for scanned/empty native documents', async () => {
  const result = await extractDocumentText(new Uint8Array([1]), {
    async readNative() {
      return '';
    },
    async readOcr() {
      return 'Texto reconhecido da imagem do edital.';
    },
  });
  assert.deepEqual(result, {
    text: 'Texto reconhecido da imagem do edital.',
    method: 'ocr',
    confidence: 'fallback',
  });
});

void test('does not send an unreadable document to the model', async () => {
  await assert.rejects(
    extractDocumentText(new Uint8Array([1]), {
      async readNative() {
        return '';
      },
      async readOcr() {
        return '  ';
      },
    }),
    /document_without_text/,
  );
});
