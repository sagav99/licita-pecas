import {
  requestPncp,
  sha256,
  type PncpProcurementCoordinates,
  type PncpRequestOptions,
} from './documents-client.ts';

const PNCP_API_BASE_URL = 'https://pncp.gov.br/api/pncp';

export type PncpProcurementItem = {
  externalId: string;
  description: string;
  codes: string[];
  quantity: number | null;
  unit: string | null;
  technicalRequirements: {
    materialOrService: string | null;
    category: string | null;
    unitValue: number | null;
    totalValue: number | null;
    additionalInformation: string | null;
    status: string | null;
  };
};

type RawItem = {
  numeroItem?: unknown;
  descricao?: unknown;
  materialOuServicoNome?: unknown;
  valorUnitarioEstimado?: unknown;
  valorTotal?: unknown;
  quantidade?: unknown;
  unidadeMedida?: unknown;
  itemCategoriaNome?: unknown;
  situacaoCompraItemNome?: unknown;
  ncmNbsCodigo?: unknown;
  catalogoCodigoItem?: unknown;
  informacaoComplementar?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 10_000)
    : null;
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildPncpItemsUrl(
  coordinates: PncpProcurementCoordinates,
  page = 1,
  baseUrl = PNCP_API_BASE_URL,
) {
  if (!/^\d{14}$/.test(coordinates.cnpj)) throw new Error('invalid_cnpj');
  if (!Number.isInteger(coordinates.year) || coordinates.year < 2000)
    throw new Error('invalid_procurement_year');
  if (!Number.isInteger(coordinates.sequence) || coordinates.sequence < 1)
    throw new Error('invalid_procurement_sequence');
  if (!Number.isInteger(page) || page < 1) throw new Error('invalid_item_page');
  const url = new URL(
    `${baseUrl}/v1/orgaos/${coordinates.cnpj}/compras/${coordinates.year}/${coordinates.sequence}/itens`,
  );
  url.searchParams.set('pagina', String(page));
  url.searchParams.set('tamanhoPagina', '50');
  return url;
}

export function parsePncpItems(payload: unknown): PncpProcurementItem[] {
  if (!Array.isArray(payload)) throw new Error('invalid_items_payload');
  return payload.flatMap((value): PncpProcurementItem[] => {
    if (!value || typeof value !== 'object') return [];
    const raw = value as RawItem;
    const itemNumber = Number(raw.numeroItem);
    const description = text(raw.descricao);
    if (!Number.isInteger(itemNumber) || itemNumber < 1 || !description)
      return [];
    const codes = [text(raw.ncmNbsCodigo), text(raw.catalogoCodigoItem)].filter(
      (code): code is string => Boolean(code),
    );
    return [
      {
        externalId: String(itemNumber),
        description,
        codes: [...new Set(codes)],
        quantity: number(raw.quantidade),
        unit: text(raw.unidadeMedida),
        technicalRequirements: {
          materialOrService: text(raw.materialOuServicoNome),
          category: text(raw.itemCategoriaNome),
          unitValue: number(raw.valorUnitarioEstimado),
          totalValue: number(raw.valorTotal),
          additionalInformation: text(raw.informacaoComplementar),
          status: text(raw.situacaoCompraItemNome),
        },
      },
    ];
  });
}

export async function fetchPncpItems(
  coordinates: PncpProcurementCoordinates,
  options: PncpRequestOptions & {
    baseUrl?: string;
    maxPages?: number;
    pageDelayMs?: number;
  } = {},
) {
  const maxPages = options.maxPages ?? 10;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20)
    throw new Error('invalid_item_page_limit');
  const items = new Map<string, PncpProcurementItem>();
  const pageDelayMs = options.pageDelayMs ?? (options.fetcher ? 0 : 500);
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await requestPncp(
      buildPncpItemsUrl(coordinates, page, options.baseUrl),
      options,
    );
    if (response.status === 204) break;
    const current = parsePncpItems(await response.json());
    for (const item of current) items.set(item.externalId, item);
    if (current.length < 50) break;
    if (pageDelayMs > 0) await sleep(pageDelayMs);
  }
  return [...items.values()].sort(
    (left, right) => Number(left.externalId) - Number(right.externalId),
  );
}

export async function procurementItemsHash(items: PncpProcurementItem[]) {
  return sha256(new TextEncoder().encode(JSON.stringify(items)));
}
