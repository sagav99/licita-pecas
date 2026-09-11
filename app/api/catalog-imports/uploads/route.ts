import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  assertCatalogFile,
  CatalogFileError,
} from '@/integrations/catalog/parse-upload';

export const runtime = 'nodejs';

function safeFilename(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-120);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }
  try {
    const input = (await request.json()) as {
      name?: unknown;
      size?: unknown;
    };
    if (typeof input.name !== 'string' || typeof input.size !== 'number') {
      throw new CatalogFileError('Arquivo inválido.');
    }
    assertCatalogFile(input.name, input.size);
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
    const path = `${membership.organization_id}/${randomUUID()}/${safeFilename(input.name)}`;
    const { data, error } = await supabase.storage
      .from('catalog-imports')
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return NextResponse.json({ path, token: data.token });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CatalogFileError
            ? error.message
            : 'Não foi possível preparar o envio do catálogo.',
      },
      { status: error instanceof CatalogFileError ? 400 : 500 },
    );
  }
}
