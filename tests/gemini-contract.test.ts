import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExtractionPrompt,
  hasUsableEvidence,
} from '../integrations/gemini/extraction-contract.ts';

void test('Gemini prompt keeps the official source and non-legal boundary explicit', () => {
  const prompt = buildExtractionPrompt(
    'https://pncp.gov.br/app/editais/exemplo',
  );
  assert.match(prompt, /fonte oficial/);
  assert.match(prompt, /Não invente campos/);
  assert.match(prompt, /habilitação jurídica/);
});

void test('partial-document prompt does not treat omitted sections as absent requirements', () => {
  const prompt = buildExtractionPrompt(
    'https://pncp.gov.br/app/editais/exemplo',
    'selected_excerpts',
  );
  assert.match(prompt, /apenas trechos selecionados/);
  assert.match(prompt, /não prova ausência/);
});

void test('an extraction without a quote cannot support a recommendation', () => {
  assert.equal(
    hasUsableEvidence({
      agency: 'Órgão',
      municipality: null,
      state: 'SP',
      object: 'Peças',
      modality: null,
      sessionAt: null,
      deadlineAt: null,
      totalValue: null,
      brands: [],
      oemCodes: [],
      applications: [],
      deliveryRequirements: [],
      fieldStatus: {},
      evidence: [
        { quote: 'curto', page: null, sourceUrl: 'https://example.com' },
      ],
    }),
    false,
  );
});
