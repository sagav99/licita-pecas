'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  validateSupplierProfile,
  type SupplierProfileInput,
} from '@/domain/supplier-profile';

export type { SupplierProfileInput } from '@/domain/supplier-profile';

export async function updateSupplierProfile(
  input: SupplierProfileInput,
): Promise<{ ok: boolean; error?: string }> {
  const profile = validateSupplierProfile(input);
  if (!profile) return { ok: false, error: 'Perfil de fornecimento inválido.' };

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

  const { data: updated, error } = await supabase
    .from('supplier_profiles')
    .update({
      regions: profile.regions,
      delivery_radius_km: profile.deliveryRadiusKm,
      catalog_rules: { brands: profile.brands, categories: profile.categories },
      exclusions: profile.exclusions,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', membership.organization_id)
    .select('organization_id')
    .maybeSingle();
  if (error || !updated)
    return { ok: false, error: 'Não foi possível salvar o perfil.' };
  revalidatePath('/');
  return { ok: true };
}

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

const workflowStatuses = new Set([
  'avaliando',
  'vai_disputar',
  'nao_atende',
  'perdida',
]);

export type OpportunityStateInput = {
  procurementId: string;
  saved: boolean;
  workflowStatus:
    | 'avaliando'
    | 'vai_disputar'
    | 'nao_atende'
    | 'perdida'
    | null;
};

export async function updateOpportunityState(
  input: OpportunityStateInput,
): Promise<{ ok: boolean; error?: string }> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input?.procurementId ?? '',
    ) ||
    typeof input.saved !== 'boolean' ||
    (input.workflowStatus !== null &&
      !workflowStatuses.has(input.workflowStatus))
  ) {
    return { ok: false, error: 'Estado da oportunidade inválido.' };
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

  const { data: match } = await supabase
    .from('matches')
    .select('id')
    .eq('organization_id', membership.organization_id)
    .eq('procurement_id', input.procurementId)
    .limit(1)
    .maybeSingle();
  if (!match) return { ok: false, error: 'Oportunidade não encontrada.' };

  if (!input.saved && input.workflowStatus === null) {
    const { error } = await supabase
      .from('opportunity_states')
      .delete()
      .eq('organization_id', membership.organization_id)
      .eq('procurement_id', input.procurementId);
    if (error)
      return { ok: false, error: 'Não foi possível atualizar a oportunidade.' };
  } else {
    const { error } = await supabase.from('opportunity_states').upsert(
      {
        organization_id: membership.organization_id,
        procurement_id: input.procurementId,
        saved: input.saved,
        workflow_status: input.workflowStatus,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,procurement_id' },
    );
    if (error)
      return { ok: false, error: 'Não foi possível atualizar a oportunidade.' };
  }

  revalidatePath('/');
  return { ok: true };
}

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
