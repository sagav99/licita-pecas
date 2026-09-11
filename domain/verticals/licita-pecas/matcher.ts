import { evaluateMatch, type MatchDecision } from '../../matching.ts';

export type MatchCatalogItem = {
  id: string;
  sku: string;
  description: string;
  oem?: string | null;
  manufacturerCode?: string | null;
  brand?: string | null;
  category?: string | null;
  application?: string | null;
};

export type MatchProcurement = {
  id: string;
  object: string;
  state: string | null;
  totalValue: number | null;
  deadlineAt: string | null;
  sourceUrl: string;
};

export type PreliminaryMatch = MatchDecision & {
  procurementId: string;
  catalogItemId: string | null;
  evidenceQuote: string;
  evidence: Array<{ quote: string; sourceUrl: string; field: string }>;
};

const serviceBlocks: Array<[RegExp, string]> = [
  [/combust[ií]vel|abastecimento/i, 'objeto centrado em combustível'],
  [
    /rastreamento|telemetria|gest[aã]o de frota/i,
    'objeto centrado em gestão de frota',
  ],
  [/loca[cç][aã]o de ve[ií]culos/i, 'objeto centrado em locação de veículos'],
  [
    /(oficina|manuten[cç][aã]o).{0,80}m[aã]o de obra|m[aã]o de obra.{0,80}(oficina|manuten[cç][aã]o)/i,
    'exige oficina ou mão de obra',
  ],
];

const stopwords = new Set([
  'para',
  'com',
  'aquisicao',
  'registro',
  'precos',
  'fornecimento',
  'municipal',
]);

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function tokens(value: string) {
  return new Set(
    normalize(value)
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 4 && !stopwords.has(part)),
  );
}

function technicalScore(object: string, item: MatchCatalogItem) {
  const normalizedObject = normalize(object);
  const codes = [item.oem, item.manufacturerCode].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  if (codes.some((code) => normalizedObject.includes(normalize(code))))
    return {
      score: 100,
      reason: `Código do SKU ${item.sku} aparece no objeto`,
    };
  if (item.brand && normalizedObject.includes(normalize(item.brand)))
    return { score: 86, reason: `Marca ${item.brand} coincide com o catálogo` };
  const itemText = [item.description, item.category, item.application]
    .filter(Boolean)
    .join(' ');
  const objectTokens = tokens(object);
  const overlap = [...tokens(itemText)].filter((token) =>
    objectTokens.has(token),
  ).length;
  if (overlap)
    return {
      score: Math.min(82, 48 + overlap * 12),
      reason: `SKU ${item.sku} compartilha ${overlap} termo(s) técnico(s)`,
    };
  return {
    score: 45,
    reason: 'Objeto automotivo amplo; itens detalhados precisam ser lidos',
  };
}

export function matchLicitaPecas(input: {
  procurement: MatchProcurement;
  catalog: MatchCatalogItem[];
  regions?: string[];
  now?: Date;
}): PreliminaryMatch {
  const { procurement, catalog } = input;
  const blocked = serviceBlocks.find(([pattern]) =>
    pattern.test(procurement.object),
  );
  const ranked = catalog
    .map((item) => ({ item, ...technicalScore(procurement.object, item) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const missing: string[] = ['requisitos detalhados do edital'];
  const reasons = best ? [best.reason] : [];
  const regions = (input.regions ?? []).map((region) => region.toUpperCase());
  let locality = 60;
  if (!regions.length) missing.push('região de atendimento');
  else if (
    procurement.state &&
    regions.includes(procurement.state.toUpperCase())
  ) {
    locality = 100;
    reasons.push(`Entrega no estado atendido: ${procurement.state}`);
  } else locality = 25;
  let volume = 50;
  if (procurement.totalValue === null) missing.push('valor estimado');
  else if (procurement.totalValue >= 5_000 && procurement.totalValue <= 150_000)
    volume = 90;
  else if (procurement.totalValue <= 300_000) volume = 70;
  const now = input.now ?? new Date();
  let deadline = 50;
  let deadlineBlock: string | undefined;
  if (!procurement.deadlineAt) missing.push('prazo final');
  else {
    const days =
      (new Date(procurement.deadlineAt).getTime() - now.getTime()) / 86_400_000;
    if (days < 0) deadlineBlock = 'prazo encerrado';
    else deadline = days <= 2 ? 40 : days <= 7 ? 70 : 90;
  }
  const decision = evaluateMatch('licita-pecas', {
    technical: best?.score ?? 0,
    volume,
    locality,
    deadline,
    requirements: 50,
    hardBlock: blocked?.[1] ?? deadlineBlock,
    missing,
    positiveReasons: reasons,
    enoughData: catalog.length > 0,
  });
  return {
    ...decision,
    procurementId: procurement.id,
    catalogItemId: best?.item.id ?? null,
    evidenceQuote: procurement.object,
    evidence: [
      {
        quote: procurement.object,
        sourceUrl: procurement.sourceUrl,
        field: 'object',
      },
    ],
  };
}
