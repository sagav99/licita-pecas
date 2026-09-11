import type { SupabaseClient } from '@supabase/supabase-js';
import {
  matchLicitaPecas,
  type MatchCatalogItem,
} from '../../domain/verticals/licita-pecas/matcher.ts';
import type { ProcurementExtraction } from '../gemini/extraction-contract.ts';

function storedExtraction(value: unknown): ProcurementExtraction | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ProcurementExtraction>;
  const stringArray = (items: unknown): items is string[] =>
    Array.isArray(items) && items.every((item) => typeof item === 'string');
  if (
    !stringArray(candidate.brands) ||
    !stringArray(candidate.oemCodes) ||
    !stringArray(candidate.applications) ||
    !stringArray(candidate.deliveryRequirements) ||
    !Array.isArray(candidate.evidence) ||
    !candidate.evidence.every(
      (evidence) =>
        evidence &&
        typeof evidence.quote === 'string' &&
        typeof evidence.sourceUrl === 'string',
    )
  )
    return null;
  return value as ProcurementExtraction;
}

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
  const procurementIds = (procurements ?? []).map((item) => item.id);
  const documents = [] as Array<{
    procurement_id: string;
    structured_data: unknown;
  }>;
  for (let index = 0; index < procurementIds.length; index += 200) {
    const { data, error } = await supabase
      .from('procurement_documents')
      .select('procurement_id,structured_data,fetched_at')
      .in('procurement_id', procurementIds.slice(index, index + 200))
      .not('structured_data', 'is', null)
      .order('fetched_at', { ascending: false });
    if (error) throw new Error(`match_documents_failed:${error.code}`);
    documents.push(...(data ?? []));
  }
  const extractionByProcurement = new Map<string, ProcurementExtraction>();
  for (const document of documents) {
    const extraction = storedExtraction(document.structured_data);
    if (!extraction) continue;
    const current = extractionByProcurement.get(document.procurement_id);
    extractionByProcurement.set(
      document.procurement_id,
      current
        ? {
            ...current,
            brands: [...new Set([...current.brands, ...extraction.brands])],
            oemCodes: [
              ...new Set([...current.oemCodes, ...extraction.oemCodes]),
            ],
            applications: [
              ...new Set([...current.applications, ...extraction.applications]),
            ],
            deliveryRequirements: [
              ...new Set([
                ...current.deliveryRequirements,
                ...extraction.deliveryRequirements,
              ]),
            ],
            evidence: [...current.evidence, ...extraction.evidence],
          }
        : extraction,
    );
  }
  const lots = [] as Array<{ id: string; procurement_id: string }>;
  for (let index = 0; index < procurementIds.length; index += 200) {
    const { data, error } = await supabase
      .from('lots')
      .select('id,procurement_id')
      .in('procurement_id', procurementIds.slice(index, index + 200))
      .eq('external_id', 'pncp-items');
    if (error) throw new Error(`match_lots_failed:${error.code}`);
    lots.push(...(data ?? []));
  }
  const procurementByLot = new Map(
    lots.map((lot) => [lot.id, lot.procurement_id]),
  );
  const itemsByProcurement = new Map<
    string,
    Array<{ description: string; codes: string[] }>
  >();
  const lotIds = lots.map((lot) => lot.id);
  for (let index = 0; index < lotIds.length; index += 200) {
    const { data, error } = await supabase
      .from('procurement_items')
      .select('lot_id,description,codes')
      .in('lot_id', lotIds.slice(index, index + 200))
      .eq('active', true);
    if (error) throw new Error(`match_items_failed:${error.code}`);
    for (const item of data ?? []) {
      const procurementId = procurementByLot.get(item.lot_id);
      if (!procurementId || typeof item.description !== 'string') continue;
      const codes = Array.isArray(item.codes)
        ? item.codes.filter((code): code is string => typeof code === 'string')
        : [];
      const current = itemsByProcurement.get(procurementId) ?? [];
      current.push({ description: item.description, codes });
      itemsByProcurement.set(procurementId, current);
    }
  }
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
          extraction: extractionByProcurement.get(procurement.id) ?? null,
          items: itemsByProcurement.get(procurement.id) ?? [],
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
