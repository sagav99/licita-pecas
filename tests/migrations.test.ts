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

void test('storage buckets stay private and enforce tenant folders', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/0003_storage.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /'catalog-imports',[\s\S]*false/);
  assert.match(sql, /'procurement-documents',[\s\S]*false/);
  assert.match(
    sql,
    /om\.organization_id::text = \(storage\.foldername\(name\)\)\[1\]/,
  );
  assert.match(sql, /owner_id = auth\.uid\(\)::text/);
  assert.doesNotMatch(
    sql,
    /create policy "[^"]*procurement[^"]*"\s+on storage\.objects for insert/,
  );
});

void test('onboarding requires authentication and grants only the authenticated role', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/0004_onboarding.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /current_user_id uuid := auth\.uid\(\)/);
  assert.match(sql, /if current_user_id is null/);
  assert.match(sql, /security definer\s+set search_path = public/);
  assert.match(sql, /revoke all on function[\s\S]+from public/);
  assert.match(sql, /grant execute on function[\s\S]+to authenticated/);
});

void test('catalog import can only be advanced inside the current organization', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/0005_catalog_import.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /catalog_imports for update to authenticated/);
  assert.match(sql, /public\.is_org_member\(organization_id\)/);
  assert.match(sql, /created_by = auth\.uid\(\)/);
  assert.match(sql, /reference_price numeric[\s\S]+reference_price >= 0/);
});

void test('source collector lease is restricted to service role', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/0006_source_collection.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /lease_until is null or lease_until <= now\(\)/);
  assert.match(sql, /revoke all on function[\s\S]+from authenticated/);
  assert.match(sql, /grant execute on function[\s\S]+to service_role/);
});

void test('summary matches have a stable idempotency key', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/0007_match_identity.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /match_key text/);
  assert.match(sql, /unique index[\s\S]+matches \(match_key\)/);
  assert.match(sql, /missing_data jsonb/);
});

void test('document registration is atomic and restricted to service role', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/0008_document_ingestion.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(sql, /register_procurement_document_version/);
  assert.match(sql, /previous_version_id/);
  assert.match(sql, /insert into public\.source_events/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /grant execute on function[\s\S]+to service_role/);
  assert.match(sql, /documents_checked_at/);
});

void test('item snapshots preserve removed records and restrict replacement', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/0009_procurement_items_ingestion.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(sql, /replace_procurement_items/);
  assert.match(sql, /set active = false/);
  assert.match(sql, /on conflict \(lot_id, external_id\) do update/);
  assert.match(sql, /items_hash/);
  assert.match(sql, /insert into public\.source_events/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
});

void test('human opportunity state is isolated and cannot target an unrelated procurement', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/0010_opportunity_states.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    sql,
    /alter table public\.opportunity_states enable row level security/,
  );
  assert.match(sql, /primary key \(organization_id, procurement_id\)/);
  assert.match(sql, /public\.is_org_member\(organization_id\)/);
  assert.match(sql, /m\.organization_id = opportunity_states\.organization_id/);
  assert.match(sql, /m\.procurement_id = opportunity_states\.procurement_id/);
  assert.match(sql, /updated_by = auth\.uid\(\)/);
  assert.match(sql, /check \(saved or workflow_status is not null\)/);
});

void test('configures Compras.gov.br as an independently recoverable source', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/0011_compras_gov_source.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(sql, /'compras-gov'/);
  assert.match(sql, /https:\/\/dadosabertos\.compras\.gov\.br/);
  assert.match(sql, /'hourly'/);
  assert.match(sql, /on conflict \(type, base_url\) do update/);
});
