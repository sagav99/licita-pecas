import assert from 'node:assert/strict';
import test from 'node:test';
import { explainStoredMatch } from '../domain/opportunity-explanation.ts';

const base = {
  reasons: ['Código OEM confere', 'Entrega no estado atendido'],
  missingData: ['Garantia não localizada'],
  evidence: [
    {
      field: 'document',
      sourceUrl: 'https://pncp.gov.br/edital.pdf',
      quote: 'Filtro OEM 123',
    },
  ],
  evidenceQuote: 'Filtro OEM 123',
  object: 'Aquisição de peças',
  sourceUrl: 'https://pncp.gov.br/app/editais/123',
};

void test('keeps every match reason and points to the document supporting the quote', () => {
  assert.deepEqual(explainStoredMatch(base), {
    reasons: base.reasons,
    missing: base.missingData,
    evidenceQuote: 'Filtro OEM 123',
    evidenceSourceUrl: 'https://pncp.gov.br/edital.pdf',
    evidenceType: 'document',
  });
});

void test('falls back to the official source without rendering unsafe evidence links', () => {
  const result = explainStoredMatch({
    ...base,
    reasons: null,
    evidence: [{ field: 'document', sourceUrl: 'javascript:alert(1)' }],
    evidenceQuote: null,
  });
  assert.deepEqual(result.reasons, []);
  assert.equal(result.evidenceQuote, base.object);
  assert.equal(result.evidenceSourceUrl, base.sourceUrl);
  assert.equal(result.evidenceType, 'object');
});
