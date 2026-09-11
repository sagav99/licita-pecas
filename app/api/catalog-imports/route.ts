import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  assertCatalogFile,
  CatalogFileError,
  parseCatalogUpload,
} from '@/integrations/catalog/parse-upload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }

  let storagePath: string | null = null;
  let importId: string | null = null;
  try {
    const input = (await request.json()) as {
      path?: unknown;
      originalName?: unknown;
    };
    if (
      typeof input.path !== 'string' ||
      typeof input.originalName !== 'string'
    ) {
      throw new CatalogFileError('Envio de catálogo inválido.');
    }
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Sua organização não foi encontrada.' },
        { status: 403 },
      );
    }
    if (!input.path.startsWith(`${membership.organization_id}/`)) {
      return NextResponse.json(
        { error: 'O arquivo não pertence à sua organização.' },
        { status: 403 },
      );
    }
    storagePath = input.path;
    const { data: storedFile, error: downloadError } = await supabase.storage
      .from('catalog-imports')
      .download(storagePath);
    if (downloadError)
      throw new CatalogFileError('Arquivo enviado não encontrado.');
    assertCatalogFile(input.originalName, storedFile.size);
    const bytes = new Uint8Array(await storedFile.arrayBuffer());
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const { items } = await parseCatalogUpload(input.originalName, bytes);
    const { data: existing } = await supabase
      .from('catalog_imports')
      .select('id,status,row_count')
      .eq('organization_id', membership.organization_id)
      .eq('content_hash', contentHash)
      .maybeSingle();
    if (existing?.status === 'imported') {
      await supabase.storage.from('catalog-imports').remove([storagePath]);
      storagePath = null;
      return NextResponse.json({
        imported: existing.row_count ?? items.length,
        catalogCount: await activeCatalogCount(
          supabase,
          membership.organization_id,
        ),
        deduplicated: true,
      });
    }
    if (existing && existing.status !== 'failed') {
      await supabase.storage.from('catalog-imports').remove([storagePath]);
      storagePath = null;
      return NextResponse.json(
        { error: 'Este arquivo já está sendo processado.' },
        { status: 409 },
      );
    }

    if (existing) {
      importId = existing.id;
      const { error } = await supabase
        .from('catalog_imports')
        .update({
          storage_path: storagePath,
          status: 'pending',
          row_count: null,
          error_summary: null,
          completed_at: null,
        })
        .eq('id', existing.id)
        .eq('organization_id', membership.organization_id);
      if (error) throw new Error(`import:${error.message}`);
    } else {
      const { data: created, error } = await supabase
        .from('catalog_imports')
        .insert({
          organization_id: membership.organization_id,
          storage_path: storagePath,
          content_hash: contentHash,
          status: 'validated',
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw new Error(`import:${error.message}`);
      importId = created.id;
    }

    const { error: itemError } = await supabase.from('catalog_items').upsert(
      items.map((item) => ({
        ...item,
        organization_id: membership.organization_id,
      })),
      { onConflict: 'organization_id,sku' },
    );
    if (itemError) throw new Error(`items:${itemError.message}`);

    const { error: completeError } = await supabase
      .from('catalog_imports')
      .update({
        status: 'imported',
        row_count: items.length,
        error_summary: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importId)
      .eq('organization_id', membership.organization_id);
    if (completeError) throw new Error(`complete:${completeError.message}`);

    return NextResponse.json({
      imported: items.length,
      catalogCount: await activeCatalogCount(
        supabase,
        membership.organization_id,
      ),
      deduplicated: false,
    });
  } catch (error) {
    const publicMessage =
      error instanceof CatalogFileError
        ? error.message
        : 'Não foi possível importar o catálogo. Tente novamente.';
    if (importId) {
      await supabase
        .from('catalog_imports')
        .update({
          status: 'failed',
          error_summary: publicMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);
    }
    if (storagePath) {
      await supabase.storage.from('catalog-imports').remove([storagePath]);
    }
    return NextResponse.json(
      { error: publicMessage },
      { status: error instanceof CatalogFileError ? 400 : 500 },
    );
  }
}

async function activeCatalogCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
) {
  const { count } = await supabase
    .from('catalog_items')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('active', true);
  return count ?? 0;
}
