import RadarClient from '@/app/radar-client';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) redirect('/onboarding');

  const [{ data: organization }, { count: catalogCount }] = await Promise.all([
    supabase
      .from('organizations')
      .select('legal_name')
      .eq('id', membership.organization_id)
      .single(),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id)
      .eq('active', true),
  ]);
  const email =
    typeof data.claims.email === 'string' ? data.claims.email : 'Usuário';

  return (
    <RadarClient
      displayName={email.split('@')[0]}
      organizationName={organization?.legal_name ?? 'Sua empresa'}
      initialCatalogCount={catalogCount ?? 0}
      initialSaved={[]}
      initialWorkflow={{}}
      signOutAction={signOut}
    />
  );
}
