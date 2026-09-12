import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSupplierProfile } from '../domain/supplier-profile.ts';

const valid = {
  regions: ['sp', 'SP', 'MG'],
  deliveryRadiusKm: 250,
  brands: ['Bosch', 'bosch'],
  categories: ['Filtros'],
  exclusions: ['instalação'],
};

void test('normalizes state and duplicate terms before saving the tenant profile', () => {
  assert.deepEqual(validateSupplierProfile(valid), {
    regions: ['SP', 'MG'],
    deliveryRadiusKm: 250,
    brands: ['Bosch'],
    categories: ['Filtros'],
    exclusions: ['instalação'],
  });
});

void test('rejects invalid states, radius and injected markup', () => {
  assert.equal(validateSupplierProfile({ ...valid, regions: ['XX'] }), null);
  assert.equal(
    validateSupplierProfile({ ...valid, deliveryRadiusKm: -1 }),
    null,
  );
  assert.equal(
    validateSupplierProfile({ ...valid, exclusions: ['<script>'] }),
    null,
  );
});
