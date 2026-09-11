import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleGeminiPdfOcr } from '../integrations/gemini/pdf-ocr.ts';

void test('sends scanned PDF inline with a transcription-only prompt', async () => {
  const calls: unknown[] = [];
  const ocr = createGoogleGeminiPdfOcr({
    apiKey: 'test-key',
    model: 'test-model',
    generator: {
      models: {
        async generateContent(input) {
          calls.push(input);
          return { text: '[Página 1]\nAquisição de filtros' };
        },
      },
    },
  });
  const text = await ocr(new TextEncoder().encode('%PDF-test'));
  assert.match(text, /Aquisição de filtros/);
  assert.equal(calls.length, 1);
  assert.match(JSON.stringify(calls[0]), /application\/pdf/);
  assert.match(JSON.stringify(calls[0]), /Não resuma/);
});
