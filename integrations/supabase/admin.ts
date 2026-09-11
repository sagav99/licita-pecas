import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url) throw new Error('supabase_url_missing');
  if (!secretKey) throw new Error('supabase_secret_key_missing');
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
