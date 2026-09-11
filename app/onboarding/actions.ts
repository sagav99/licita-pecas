'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createOrganization(formData: FormData) {
  const rawLegalName = formData.get('legal_name');
  const rawCnpj = formData.get('cnpj');
  const legalName = (
    typeof rawLegalName === 'string' ? rawLegalName : ''
  ).trim();
  const cnpj = (typeof rawCnpj === 'string' ? rawCnpj : '').replace(/\D/g, '');
  if (legalName.length < 3)
    redirect('/onboarding?error=Informe a razão social ou nome da empresa.');
  if (cnpj && cnpj.length !== 14)
    redirect('/onboarding?error=O CNPJ deve conter 14 números.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_organization_for_current_user', {
    organization_name: legalName,
    organization_cnpj: cnpj || null,
  });
  if (error)
    redirect('/onboarding?error=Não foi possível configurar a empresa.');
  redirect('/');
}
