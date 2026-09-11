import type { SupabaseClient } from '@supabase/supabase-js';
import {
  matchLicitaPecas,
  type MatchCatalogItem,
} from '../../domain/verticals/licita-pecas/matcher.ts';

export async function generateLicitaPecasMatches(
  supabase: SupabaseClient,
  now = new Date(),
  organizationIds?: string[],
) {
  let organizationQuery = supabase
    .from('organizations')
    .select('id')
    .eq('vertical', 'licita-pecas')
    .eq('status', 'active');
  if (organizationIds?.length)
    organizationQuery = organizationQuery.in('id', organizationIds);
  const { data: organizations, error: organizationError } =
    await organizationQuery;
  if (organizationError)
    throw new Error(`match_organizations_failed:${organizationError.code}`);
  const { data: procurements, error: procurementError } = await supabase
    .from('procurements')
    .select('id,object,state,total_value,deadline_at,source_url')
    .or(`deadline_at.is.null,deadline_at.gte.${now.toISOString()}`)
    .limit(1000);
  if (procurementError)
    throw new Error(`match_procurements_failed:${procurementError.code}`);
  let generated = 0;
  for (const organization of organizations ?? []) {
    const [
      { data: catalog, error: catalogError },
      { data: profile, error: profileError },
    ] = await Promise.all([
      supabase
        .from('catalog_items')
        .select(
          'id,sku,description,oem,manufacturer_code,brand,category,application',
        )
        .eq('organization_id', organization.id)
        .eq('active', true),
      supabase
        .from('supplier_profiles')
        .select('regions')
        .eq('organization_id', organization.id)
        .maybeSingle(),
    ]);
    if (catalogError || profileError)
      throw new Error(
        `match_profile_failed:${catalogError?.code ?? profileError?.code}`,
      );
    if (!catalog?.length) continue;
    const normalizedCatalog: MatchCatalogItem[] = catalog.map((item) => ({
      id: item.id,
      sku: item.sku,
      description: item.description,
      oem: item.oem,
      manufacturerCode: item.manufacturer_code,
      brand: item.brand,
      category: item.category,
      application: item.application,
    }));
    const rows = (procurements ?? []).map((procurement) => {
      const result = matchLicitaPecas({
        procurement: {
          id: procurement.id,
          object: procurement.object,
          state: procurement.state,
          totalValue: procurement.total_value,
          deadlineAt: procurement.deadline_at,
          sourceUrl: procurement.source_url,
        },
        catalog: normalizedCatalog,
        regions: profile?.regions ?? [],
        now,
      });
      const negativeReasons = result.reasons.filter((reason) =>
        reason.startsWith('Bloqueio:'),
      );
      return {
        match_key: `${organization.id}:${procurement.id}:summary`,
        organization_id: organization.id,
        procurement_id: procurement.id,
        catalog_item_id: result.catalogItemId,
        status: result.status,
        score: result.score,
        reasons: result.reasons,
        negative_reasons: negativeReasons,
        missing_data: result.missing,
        evidence_quote: result.evidenceQuote,
        evidence: result.evidence,
      };
    });
    for (let index = 0; index < rows.length; index += 200) {
      const batch = rows.slice(index, index + 200);
      const { error } = await supabase
        .from('matches')
        .upsert(batch, { onConflict: 'match_key' });
      if (error) throw new Error(`match_upsert_failed:${error.code}`);
      generated += batch.length;
    }
  }
  return {
    organizations: organizations?.length ?? 0,
    procurements: procurements?.length ?? 0,
    generated,
  };
}
