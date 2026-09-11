import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMatch, mapCatalogHeaders } from '../domain/catalog.ts';

void test('maps common catalog header aliases without requiring every column', () => {
  assert.deepEqual(
    mapCatalogHeaders([
      'Código Produto',
      'Descrição',
      'OEM',
      'Saldo',
      'Campo livre',
    ]),
    [
      { source: 'Código Produto', target: 'sku', targetLabel: 'SKU' },
      { source: 'Descrição', target: 'descricao', targetLabel: 'Descrição' },
      { source: 'OEM', target: 'codigo_oem', targetLabel: 'Código OEM' },
      { source: 'Saldo', target: 'estoque', targetLabel: 'Estoque' },
      { source: 'Campo livre', target: null, targetLabel: null },
    ],
  );
});

void test('uses a hard operational block even with a strong technical match', () => {
  assert.deepEqual(
    calculateMatch({
      technical: 95,
      volume: 90,
      locality: 20,
      deadline: 80,
      requirements: 70,
      hardBlock: true,
    }),
    {
      status: 'incompatível',
      score: 49,
    },
  );
});

void test('does not invent a score when the notice lacks enough data', () => {
  assert.deepEqual(
    calculateMatch({
      technical: 0,
      volume: 0,
      locality: 0,
      deadline: 0,
      requirements: 0,
      enoughData: false,
    }),
    {
      status: 'sem dados suficientes',
      score: null,
    },
  );
});
