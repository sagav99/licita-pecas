import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMatchFeedback } from '../domain/match-feedback.ts';

const valid = {
  matchId: '9c79f01b-cd91-4d74-a45a-9dfb69ed3e30',
  rating: 'parcial',
  reason: 'Prazo de entrega ainda precisa de revisão. ',
};

void test('accepts a bounded quality rating with an optional explanation', () => {
  assert.deepEqual(validateMatchFeedback(valid), {
    ...valid,
    reason: valid.reason.trim(),
  });
  assert.equal(validateMatchFeedback({ ...valid, reason: '' })?.reason, null);
  assert.equal(
    validateMatchFeedback({
      ...valid,
      reason: 'Marca correta\nmas sem estoque',
    })?.reason,
    'Marca correta mas sem estoque',
  );
});

void test('rejects arbitrary match IDs, ratings and oversized explanations', () => {
  assert.equal(
    validateMatchFeedback({ ...valid, matchId: 'other-tenant' }),
    null,
  );
  assert.equal(
    validateMatchFeedback({ ...valid, rating: 'juridicamente habilitado' }),
    null,
  );
  assert.equal(
    validateMatchFeedback({ ...valid, reason: 'x'.repeat(501) }),
    null,
  );
});
