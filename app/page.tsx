import RadarClient, { type RadarOpportunity } from '@/app/radar-client';
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

  const [{ data: organization }, { count: catalogCount }, { data: matches }] =
    await Promise.all([
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
      supabase
        .from('matches')
        .select(
          'status,score,reasons,evidence_quote,procurements!inner(external_id,agency,municipality,state,modality,object,total_value,deadline_at,source_url)',
        )
        .eq('organization_id', membership.organization_id)
        .order('score', { ascending: false, nullsFirst: false })
        .limit(100),
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
      initialOpportunities={(matches ?? []).flatMap(
        (match): RadarOpportunity[] => {
          const procurement = Array.isArray(match.procurements)
            ? match.procurements[0]
            : match.procurements;
          if (!procurement) return [];
          const reasons = Array.isArray(match.reasons)
            ? match.reasons.filter(
                (value): value is string => typeof value === 'string',
              )
            : [];
          return [
            {
              id: procurement.external_id,
              agency: procurement.agency,
              title: procurement.object,
              location:
                [procurement.municipality, procurement.state]
                  .filter(Boolean)
                  .join(' · ') || 'Local não informado',
              value:
                procurement.total_value === null
                  ? 'Não informado'
                  : new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      maximumFractionDigits: 0,
                    }).format(procurement.total_value),
              deadline: procurement.deadline_at
                ? new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(procurement.deadline_at))
                : 'Não informado',
              deadlineAt: procurement.deadline_at,
              score: match.score,
              status:
                match.status === 'compatível'
                  ? 'Compatível'
                  : match.status === 'incompatível'
                    ? 'Incompatível'
                    : match.status === 'sem dados suficientes'
                      ? 'Sem dados'
                      : 'Revisar',
              tags: [procurement.modality, procurement.state].filter(
                (value): value is string => Boolean(value),
              ),
              reason:
                reasons[0] ?? 'Dados preliminares; confira o edital oficial.',
              evidence: match.evidence_quote ?? procurement.object,
              sourceUrl: procurement.source_url,
            },
          ];
        },
      )}
      signOutAction={signOut}
    />
  );
}
