import assert from 'node:assert/strict';
import test from 'node:test';
import { matchLicitaPecas } from '../domain/verticals/licita-pecas/matcher.ts';

const procurement = {
  id: 'p1',
  object: 'Aquisição de filtro de óleo OEM ABC-123 para frota',
  state: 'SP',
  totalValue: 84000,
  deadlineAt: '2026-09-20T12:00:00Z',
  sourceUrl: 'https://pncp.gov.br/app/editais/x',
};
const catalog = [
  {
    id: 'c1',
    sku: 'FIL-1',
    description: 'Filtro de óleo diesel',
    oem: 'ABC-123',
    brand: null,
  },
];

void test('finds exact OEM and keeps preliminary result explainable', () => {
  const result = matchLicitaPecas({
    procurement,
    catalog,
    regions: ['SP'],
    now: new Date('2026-09-11T12:00:00Z'),
  });
  assert.equal(result.status, 'compatível');
  assert.equal(result.catalogItemId, 'c1');
  assert.match(result.reasons[0], /Código/);
  assert.equal(result.evidence[0].sourceUrl, procurement.sourceUrl);
});

void test('hard-blocks workshop services even when a SKU overlaps', () => {
  const result = matchLicitaPecas({
    procurement: {
      ...procurement,
      object: 'Manutenção de filtro com oficina e mão de obra',
    },
    catalog,
    now: new Date('2026-09-11T12:00:00Z'),
  });
  assert.equal(result.status, 'incompatível');
  assert.match(result.reasons.join(' '), /oficina/);
});

void test('does not claim compatibility without a customer catalog', () => {
  const result = matchLicitaPecas({
    procurement,
    catalog: [],
    now: new Date('2026-09-11T12:00:00Z'),
  });
  assert.equal(result.status, 'sem dados suficientes');
  assert.equal(result.catalogItemId, null);
});
