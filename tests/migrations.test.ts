import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../supabase/migrations/0002_operational_core.sql',
  import.meta.url,
);

void test('operational tables enable RLS and tenant policies', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  const tenantTables = [
    'supplier_profiles',
    'alert_preferences',
    'match_feedback',
    'catalog_imports',
  ];
  for (const table of tenantTables) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }
  assert.match(sql, /public\.is_org_member\(organization_id\)/);
  assert.match(sql, /created_by = auth\.uid\(\)/);
});

void test('shared procurement children are only exposed through an organization match', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(
    sql,
    /create or replace function public\.can_access_procurement/,
  );
  assert.match(sql, /public\.can_access_procurement\(procurement_id\)/);
  assert.match(sql, /public\.can_access_procurement\(l\.procurement_id\)/);
  assert.match(sql, /sources[^]*não recebe policy de cliente/);
});

void test('document and event identities preserve idempotency', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /unique \(procurement_id, url, content_hash\)/);
  assert.match(sql, /dedupe_key text not null unique/);
  assert.match(sql, /unique \(organization_id, content_hash\)/);
});
