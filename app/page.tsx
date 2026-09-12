import RadarClient, {
  type AlertActivity,
  type AlertPreferences,
  type CatalogPreviewItem,
  type RadarOpportunity,
} from '@/app/radar-client';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { storedProfileTerms } from '@/domain/supplier-profile';
import {
  signOut,
  updateAlertPreferences,
  updateOpportunityState,
  updateSupplierProfile,
} from './actions';

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

  const [
    { data: organization },
    { count: catalogCount },
    { data: catalogItems },
    { data: latestImport },
    { data: alertPreferences },
    { data: alertActivity },
    { data: opportunityStates },
    { data: matches },
    { data: supplierProfile },
  ] = await Promise.all([
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
      .from('catalog_items')
      .select(
        'sku,description,oem,manufacturer_code,brand,stock,lead_time_days,application',
      )
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('catalog_imports')
      .select('completed_at')
      .eq('organization_id', membership.organization_id)
      .eq('status', 'imported')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('alert_preferences')
      .select('email_enabled,enabled_types')
      .eq('organization_id', membership.organization_id)
      .maybeSingle(),
    supabase
      .from('alerts')
      .select('id,type,sent_at,procurements!inner(agency)')
      .eq('organization_id', membership.organization_id)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('opportunity_states')
      .select('procurement_id,saved,workflow_status')
      .eq('organization_id', membership.organization_id),
    supabase
      .from('matches')
      .select(
        'status,score,reasons,evidence_quote,procurements!inner(id,external_id,agency,municipality,state,modality,object,total_value,deadline_at,source_url)',
      )
      .eq('organization_id', membership.organization_id)
      .order('score', { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from('supplier_profiles')
      .select('regions,delivery_radius_km,catalog_rules,exclusions')
      .eq('organization_id', membership.organization_id)
      .maybeSingle(),
  ]);
  const email =
    typeof data.claims.email === 'string' ? data.claims.email : 'Usuário';
  const catalogRows = catalogItems ?? [];
  const leadTimes = catalogRows.flatMap((item) =>
    typeof item.lead_time_days === 'number' ? [item.lead_time_days] : [],
  );
  const initialCatalogItems: CatalogPreviewItem[] = catalogRows
    .slice(0, 8)
    .map((item) => ({
      sku: item.sku,
      description: item.description,
      code: item.oem || item.manufacturer_code || null,
      brand: item.brand,
      stock: item.stock,
      leadTimeDays: item.lead_time_days,
    }));
  const initialAlertPreferences: AlertPreferences = {
    emailEnabled: alertPreferences?.email_enabled ?? true,
    enabledTypes: Array.isArray(alertPreferences?.enabled_types)
      ? alertPreferences.enabled_types.filter(
          (type): type is string => typeof type === 'string',
        )
      : [],
  };
  const initialAlertActivity: AlertActivity[] = (alertActivity ?? []).flatMap(
    (item) => {
      const procurement = Array.isArray(item.procurements)
        ? item.procurements[0]
        : item.procurements;
      if (!procurement) return [];
      return [
        {
          id: item.id,
          type: item.type,
          sentAt: item.sent_at,
          agency: procurement.agency,
        },
      ];
    },
  );
  const rawOpportunities = (matches ?? []).flatMap(
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
          id: procurement.id,
          externalId: procurement.external_id,
          agency: procurement.agency,
          title: procurement.object,
          location:
            [procurement.municipality, procurement.state]
              .filter(Boolean)
              .join(' · ') || 'Local não informado',
          state: procurement.state,
          value:
            procurement.total_value === null
              ? 'Não informado'
              : new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(procurement.total_value),
          totalValue: procurement.total_value,
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
          reason: reasons[0] ?? 'Dados preliminares; confira o edital oficial.',
          evidence: match.evidence_quote ?? procurement.object,
          sourceUrl: procurement.source_url,
        },
      ];
    },
  );
  const opportunities = [
    ...new Map(rawOpportunities.map((item) => [item.id, item])).values(),
  ];
  const workflowLabels: Record<string, string> = {
    avaliando: 'Avaliando',
    vai_disputar: 'Vai disputar',
    nao_atende: 'Não atende',
    perdida: 'Perdida',
  };
  const initialSaved = (opportunityStates ?? [])
    .filter((state) => state.saved)
    .map((state) => state.procurement_id);
  const initialWorkflow = Object.fromEntries(
    (opportunityStates ?? []).flatMap((state) => {
      const label = state.workflow_status
        ? workflowLabels[state.workflow_status]
        : undefined;
      return label ? [[state.procurement_id, label]] : [];
    }),
  );

  return (
    <RadarClient
      displayName={email.split('@')[0]}
      email={email}
      organizationName={organization?.legal_name ?? 'Sua empresa'}
      initialCatalogCount={catalogCount ?? 0}
      initialCatalogItems={initialCatalogItems}
      initialCatalogMetrics={{
        analyzedCount: catalogRows.length,
        withCodeCount: catalogRows.filter((item) =>
          Boolean(item.oem?.trim() || item.manufacturer_code?.trim()),
        ).length,
        missingApplicationCount: catalogRows.filter(
          (item) => !item.application?.trim(),
        ).length,
        averageLeadTimeDays: leadTimes.length
          ? leadTimes.reduce((total, value) => total + value, 0) /
            leadTimes.length
          : null,
        lastImportAt: latestImport?.completed_at ?? null,
      }}
      initialAlertPreferences={initialAlertPreferences}
      initialAlertActivity={initialAlertActivity}
      initialSupplierProfile={{
        regions: storedProfileTerms(supplierProfile?.regions, 27),
        deliveryRadiusKm: supplierProfile?.delivery_radius_km ?? null,
        brands: storedProfileTerms(supplierProfile?.catalog_rules?.brands, 30),
        categories: storedProfileTerms(
          supplierProfile?.catalog_rules?.categories,
          30,
        ),
        exclusions: storedProfileTerms(supplierProfile?.exclusions, 20),
      }}
      updateAlertPreferencesAction={updateAlertPreferences}
      updateOpportunityStateAction={updateOpportunityState}
      updateSupplierProfileAction={updateSupplierProfile}
      initialSaved={initialSaved}
      initialWorkflow={initialWorkflow}
      initialOpportunities={opportunities}
      signOutAction={signOut}
    />
  );
}
