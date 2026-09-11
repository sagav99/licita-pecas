import assert from 'node:assert/strict';
import test from 'node:test';
import { isLicitaPecasDiscoveryCandidate } from '../domain/verticals/licita-pecas/discovery.ts';

void test('keeps broad automotive notices for structured matching', () => {
  assert.equal(
    isLicitaPecasDiscoveryCandidate({
      object: 'Aquisição de peças para manutenção da frota municipal',
    }),
    true,
  );
  assert.equal(
    isLicitaPecasDiscoveryCandidate({
      object: 'Fornecimento de filtros de óleo para caminhões',
    }),
    true,
  );
});

void test('drops an unrelated notice before consuming storage and AI quota', () => {
  assert.equal(
    isLicitaPecasDiscoveryCandidate({
      object: 'Aquisição de material pedagógico para escolas',
    }),
    false,
  );
  assert.equal(
    isLicitaPecasDiscoveryCandidate({
      object:
        'Jornal regional para veiculação de publicações, atos oficiais e editais',
    }),
    false,
  );
});
