'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const alertTypes = new Set([
  'new_match',
  'procurement_changed',
  'deadline_near',
  'item_reclassified',
]);

export type AlertPreferencesInput = {
  emailEnabled: boolean;
  enabledTypes: string[];
};

export async function updateAlertPreferences(
  input: AlertPreferencesInput,
): Promise<{ ok: boolean; error?: string }> {
  if (
    typeof input?.emailEnabled !== 'boolean' ||
    !Array.isArray(input.enabledTypes) ||
    input.enabledTypes.some((type) => !alertTypes.has(type))
  ) {
    return { ok: false, error: 'Preferência inválida.' };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { ok: false, error: 'Sessão expirada.' };

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return { ok: false, error: 'Organização não encontrada.' };

  const enabledTypes = [...new Set(input.enabledTypes)];
  const { error } = await supabase
    .from('alert_preferences')
    .update({
      email_enabled: input.emailEnabled,
      enabled_types: enabledTypes,
      unsubscribed_at: input.emailEnabled ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', membership.organization_id);

  if (error)
    return { ok: false, error: 'Não foi possível salvar a preferência.' };
  revalidatePath('/');
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
