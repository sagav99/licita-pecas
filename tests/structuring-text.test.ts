import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_STRUCTURING_CHARACTERS,
  retainVerifiedDocumentEvidence,
  selectStructuringText,
} from '../integrations/documents/select-structuring-text.ts';

void test('preserves a short document verbatim for evidence checking', () => {
  const original = 'Aquisição de filtros automotivos';
  const result = selectStructuringText(original);
  assert.deepEqual(result, {
    text: original,
    scope: 'full',
    originalCharacters: original.length,
  });
});

void test('selects relevant distant excerpts without exceeding the model budget', () => {
  const original =
    'Edital oficial. '.repeat(1000) +
    'Texto genérico. '.repeat(9000) +
    'Código OEM ABC-123 para filtro de óleo diesel. '.repeat(200) +
    'Fim do documento. '.repeat(1000);
  const result = selectStructuringText(original);
  assert.equal(result.scope, 'selected_excerpts');
  assert.equal(result.originalCharacters, original.length);
  assert.ok(result.text.length <= MAX_STRUCTURING_CHARACTERS);
  assert.ok(result.text.includes('Código OEM ABC-123'));
  assert.ok(result.text.includes('Edital oficial'));
  assert.ok(result.text.includes('Fim do documento'));
});

void test('rejects a quote that appears only after artificial excerpt joining', () => {
  assert.throws(
    () =>
      retainVerifiedDocumentEvidence(
        { evidence: [{ quote: 'trecho que não existe no PDF' }] },
        'Trecho verdadeiro do edital original.',
      ),
    /document_unverified_evidence/,
  );
});
