import assert from 'node:assert/strict';
import test from 'node:test';
import { createGeminiExtractionAdapter } from '../integrations/gemini/adapter.ts';

const extraction = {
  agency: 'Prefeitura de Exemplo',
  municipality: 'Exemplo',
  state: 'SP',
  object: 'Filtros',
  modality: 'Pregão',
  sessionAt: null,
  deadlineAt: null,
  totalValue: 1000,
  brands: [],
  oemCodes: [],
  applications: [],
  deliveryRequirements: [],
  fieldStatus: { object: 'confirmado' },
  evidence: [
    {
      quote: 'Aquisição de filtros automotivos',
      page: 1,
      sourceUrl: 'https://example.com/edital.pdf',
    },
  ],
};

void test('keeps Gemini behind an injectable client and validates evidence', async () => {
  const calls: string[] = [];
  const adapter = createGeminiExtractionAdapter({
    async generate(input) {
      calls.push(input.prompt);
      return JSON.stringify(extraction);
    },
  });
  const result = await adapter.extract({
    sourceUrl: 'https://example.com/edital.pdf',
    text: 'texto',
  });
  assert.equal(result.object, 'Filtros');
  assert.equal(calls.length, 1);
});

void test('rejects malformed model output without evidence', async () => {
  const adapter = createGeminiExtractionAdapter({
    async generate() {
      return '{';
    },
  });
  await assert.rejects(
    adapter.extract({ sourceUrl: 'https://example.com', text: 'x' }),
    /gemini_invalid_json/,
  );
});
