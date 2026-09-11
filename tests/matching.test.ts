import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMatch } from '../domain/matching.ts';

void test('returns explainable compatible decision for Licita Peças', () => {
  assert.deepEqual(
    evaluateMatch('licita-pecas', {
      technical: 96,
      volume: 90,
      locality: 80,
      deadline: 90,
      requirements: 85,
      positiveReasons: ['3 códigos OEM coincidem'],
    }),
    {
      status: 'compatível',
      score: 90,
      vertical: 'licita-pecas',
      reasons: ['3 códigos OEM coincidem'],
      missing: [],
    },
  );
});

void test('keeps a hard block visible instead of hiding it in the score', () => {
  const decision = evaluateMatch('licita-pecas', {
    technical: 100,
    volume: 100,
    locality: 100,
    deadline: 100,
    requirements: 100,
    hardBlock: 'exige oficina própria',
  });
  assert.equal(decision.status, 'incompatível');
  assert.match(decision.reasons[0] ?? '', /oficina/);
});

void test('uses missing fields rather than inventing a low-confidence match', () => {
  const decision = evaluateMatch('licita-agua', {
    technical: 80,
    volume: 50,
    locality: 80,
    deadline: 70,
    requirements: 40,
    missing: ['concentração'],
  });
  assert.equal(decision.status, 'sem dados suficientes');
  assert.deepEqual(decision.missing, ['concentração']);
});
