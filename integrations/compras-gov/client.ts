import type { NormalizedProcurement } from '../pncp/client.ts';

const DEFAULT_BASE_URL = 'https://dadosabertos.compras.gov.br';
const PATH = '/modulo-contratacoes/1_consultarContratacoes_PNCP_14133';

export type ComprasGovSearch = {
  startDate: string;
  endDate: string;
  modalityCode: number;
  page?: number;
  pageSize?: number;
};

type ComprasGovRecord = {
  numeroControlePNCP?: unknown;
  orgaoEntidadeRazaoSocial?: unknown;
  unidadeOrgaoUfSigla?: unknown;
  unidadeOrgaoMunicipioNome?: unknown;
  modalidadeNome?: unknown;
  situacaoCompraNomePncp?: unknown;
  objetoCompra?: unknown;
  valorTotalEstimado?: unknown;
  dataPublicacaoPncp?: unknown;
  dataAberturaPropostaPncp?: unknown;
  dataEncerramentoPropostaPncp?: unknown;
  contratacaoExcluida?: unknown;
};

type ComprasGovPayload = {
  resultado?: unknown;
  totalPaginas?: unknown;
  paginasRestantes?: unknown;
};

export type ComprasGovPage = {
  records: NormalizedProcurement[];
  page: number;
  totalPages: number;
  remainingPages: number;
};

export type ComprasGovCollection = {
  records: NormalizedProcurement[];
  pagesFetched: number;
  totalPages: number;
  truncated: boolean;
};

function requiredDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${field}_must_be_yyyy_mm_dd`);
}

export function buildComprasGovSearchUrl(
  search: ComprasGovSearch,
  baseUrl = DEFAULT_BASE_URL,
) {
  requiredDate(search.startDate, 'start_date');
  requiredDate(search.endDate, 'end_date');
  if (search.startDate > search.endDate) throw new Error('invalid_date_range');
  if (!Number.isInteger(search.modalityCode) || search.modalityCode <= 0)
    throw new Error('invalid_modality_code');
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 50;
  if (!Number.isInteger(page) || page < 1) throw new Error('invalid_page');
  if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 500)
    throw new Error('invalid_page_size');

  const url = new URL(PATH, baseUrl);
  url.searchParams.set('pagina', String(page));
  url.searchParams.set('tamanhoPagina', String(pageSize));
  url.searchParams.set('dataPublicacaoPncpInicial', search.startDate);
  url.searchParams.set('dataPublicacaoPncpFinal', search.endDate);
  url.searchParams.set('codigoModalidade', String(search.modalityCode));
  return url;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestamp(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const complete = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T00:00:00-03:00`
    : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
      ? raw
      : `${raw}-03:00`;
  const parsed = new Date(complete);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function officialUrl(externalId: string): string | null {
  const match = externalId.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (match)
    return `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${Number(match[2])}`;
  return null;
}

export function parseComprasGovPage(
  payload: unknown,
  requestedPage = 1,
): ComprasGovPage {
  if (!payload || typeof payload !== 'object')
    throw new Error('invalid_payload');
  const page = payload as ComprasGovPayload;
  if (!Array.isArray(page.resultado)) throw new Error('invalid_payload_data');

  const records = page.resultado.flatMap((raw): NormalizedProcurement[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as ComprasGovRecord;
    if (item.contratacaoExcluida === true) return [];
    const externalId = text(item.numeroControlePNCP);
    const agency = text(item.orgaoEntidadeRazaoSocial);
    const object = text(item.objetoCompra);
    if (!externalId || !agency || !object) return [];
    const sourceUrl = officialUrl(externalId);
    if (!sourceUrl) return [];
    return [
      {
        externalId,
        agency,
        municipality: text(item.unidadeOrgaoMunicipioNome),
        state: text(item.unidadeOrgaoUfSigla),
        modality: text(item.modalidadeNome),
        status: text(item.situacaoCompraNomePncp) ?? 'não informado',
        object,
        publishedAt: timestamp(item.dataPublicacaoPncp),
        sessionAt: timestamp(item.dataAberturaPropostaPncp),
        deadlineAt: timestamp(item.dataEncerramentoPropostaPncp),
        totalValue: number(item.valorTotalEstimado),
        sourceUrl,
      },
    ];
  });
  return {
    records,
    page: requestedPage,
    totalPages: number(page.totalPaginas) ?? 0,
    remainingPages: number(page.paginasRestantes) ?? 0,
  };
}

export async function fetchComprasGovPage(
  search: ComprasGovSearch,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    baseUrl?: string;
    attempts?: number;
    sleep?: (delayMs: number) => Promise<void>;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const attempts = options.attempts ?? 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const timeout = AbortSignal.timeout(15_000);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    const response = await fetcher(
      buildComprasGovSearchUrl(search, options.baseUrl),
      { headers: { Accept: 'application/json' }, signal },
    );
    if (response.ok)
      return parseComprasGovPage(await response.json(), search.page ?? 1);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts - 1)
      throw new Error(`compras_gov_http_${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 30_000)
        : ([2_000, 5_000, 10_000][attempt] ?? 10_000);
    await sleep(delay);
  }
  throw new Error('compras_gov_retry_exhausted');
}

export async function collectComprasGovPages(
  search: ComprasGovSearch,
  options: {
    fetchPage?: (search: ComprasGovSearch) => Promise<ComprasGovPage>;
    maxPages?: number;
    baseUrl?: string;
    pageDelayMs?: number;
    sleep?: (delayMs: number) => Promise<void>;
  } = {},
): Promise<ComprasGovCollection> {
  const maxPages = options.maxPages ?? 10;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100)
    throw new Error('invalid_max_pages');
  const fetchPage =
    options.fetchPage ??
    ((pageSearch) =>
      fetchComprasGovPage(pageSearch, { baseUrl: options.baseUrl }));
  const pageDelayMs = options.pageDelayMs ?? (options.fetchPage ? 0 : 750);
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let requestedPage = search.page ?? 1;
  let totalPages = requestedPage;
  let pagesFetched = 0;
  const seenPages = new Set<number>();
  const byExternalId = new Map<string, NormalizedProcurement>();

  while (pagesFetched < maxPages) {
    const page = await fetchPage({ ...search, page: requestedPage });
    if (seenPages.has(page.page)) throw new Error('compras_gov_repeated_page');
    seenPages.add(page.page);
    pagesFetched += 1;
    totalPages = Math.max(totalPages, page.totalPages);
    for (const record of page.records) {
      if (!byExternalId.has(record.externalId))
        byExternalId.set(record.externalId, record);
    }
    const hasNextPage = page.remainingPages > 0 || page.page < page.totalPages;
    if (!hasNextPage) break;
    requestedPage = page.page + 1;
    if (pageDelayMs > 0) await sleep(pageDelayMs);
  }
  return {
    records: [...byExternalId.values()],
    pagesFetched,
    totalPages,
    truncated: requestedPage <= totalPages && pagesFetched >= maxPages,
  };
}
