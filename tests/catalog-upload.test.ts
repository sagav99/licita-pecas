import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CatalogFileError,
  parseCatalogUpload,
  parseCsv,
} from '../integrations/catalog/parse-upload.ts';

void test('parses quoted CSV cells and chooses semicolon delimiter', () => {
  assert.deepEqual(
    parseCsv('sku;descricao;marca\nA1;"Filtro, diesel";ACME\n'),
    [
      ['sku', 'descricao', 'marca'],
      ['A1', 'Filtro, diesel', 'ACME'],
    ],
  );
});

void test('normalizes catalog rows and deduplicates SKU', async () => {
  const csv = [
    'Código Produto;Descrição;Preço Venda;Saldo;Prazo Entrega',
    'A-1;Filtro antigo;10,50;2;3',
    'A-1;Filtro diesel;12,90;4;2',
  ].join('\n');
  const result = await parseCatalogUpload(
    'catalogo.csv',
    new TextEncoder().encode(csv),
  );
  assert.equal(result.sourceRowCount, 2);
  assert.deepEqual(result.items, [
    {
      sku: 'A-1',
      description: 'Filtro diesel',
      oem: null,
      manufacturer_code: null,
      brand: null,
      category: null,
      application: null,
      compatible_vehicles: null,
      part_type: null,
      originalidade: null,
      reference_price: 12.9,
      stock: 4,
      lead_time_days: 2,
      active: true,
    },
  ]);
});

void test('rejects catalogs without required mapped columns', async () => {
  await assert.rejects(
    parseCatalogUpload(
      'catalogo.csv',
      new TextEncoder().encode('marca;produto\nACME;Filtro'),
    ),
    (error: unknown) =>
      error instanceof CatalogFileError && /SKU/.test(error.message),
  );
});
