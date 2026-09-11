const DEFAULT_BASE_URL = 'https://pncp.gov.br/api/consulta/v1';

export type PncpSearch = {
  startDate: string;
  endDate: string;
  modalityCode: number;
  page?: number;
  pageSize?: number;
};

type PncpRecord = {
  numeroControlePNCP?: unknown;
  anoCompra?: unknown;
  sequencialCompra?: unknown;
  objetoCompra?: unknown;
  modalidadeNome?: unknown;
  situacaoCompraNome?: unknown;
  valorTotalEstimado?: unknown;
  dataPublicacaoPncp?: unknown;
  dataAberturaProposta?: unknown;
  dataEncerramentoProposta?: unknown;
  linkSistemaOrigem?: unknown;
  orgaoEntidade?: { cnpj?: unknown; razaoSocial?: unknown };
  unidadeOrgao?: { municipioNome?: unknown; ufSigla?: unknown };
};

type PncpPayload = {
  data?: unknown;
  totalPaginas?: unknown;
  numeroPagina?: unknown;
  paginasRestantes?: unknown;
};

export type NormalizedProcurement = {
  externalId: string;
  agency: string;
  municipality: string | null;
  state: string | null;
  modality: string | null;
  status: string;
  object: string;
  publishedAt: string | null;
  sessionAt: string | null;
  deadlineAt: string | null;
  totalValue: number | null;
  sourceUrl: string;
};

export type PncpPage = {
  records: NormalizedProcurement[];
  page: number;
  totalPages: number;
  remainingPages: number;
};

export type PncpCollection = {
  records: NormalizedProcurement[];
  pagesFetched: number;
  totalPages: number;
  truncated: boolean;
};

function assertDate(value: string, field: string) {
  if (!/^\d{8}$/.test(value)) throw new Error(`${field}_must_be_yyyymmdd`);
}

export function buildPncpSearchUrl(
  search: PncpSearch,
  baseUrl = DEFAULT_BASE_URL,
) {
  assertDate(search.startDate, 'start_date');
  assertDate(search.endDate, 'end_date');
  if (search.startDate > search.endDate) throw new Error('invalid_date_range');
  if (!Number.isInteger(search.modalityCode) || search.modalityCode <= 0)
    throw new Error('invalid_modality_code');
  if (
    search.page !== undefined &&
    (!Number.isInteger(search.page) || search.page < 1)
  )
    throw new Error('invalid_page');
  if (
    search.pageSize !== undefined &&
    (!Number.isInteger(search.pageSize) ||
      search.pageSize < 1 ||
      search.pageSize > 500)
  )
    throw new Error('invalid_page_size');
  const url = new URL(`${baseUrl}/contratacoes/publicacao`);
  url.searchParams.set('dataInicial', search.startDate);
  url.searchParams.set('dataFinal', search.endDate);
  url.searchParams.set(
    'codigoModalidadeContratacao',
    String(search.modalityCode),
  );
  url.searchParams.set('pagina', String(search.page ?? 1));
  url.searchParams.set('tamanhoPagina', String(search.pageSize ?? 50));
  return url;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parsePncpPage(payload: unknown): PncpPage {
  if (!payload || typeof payload !== 'object')
    throw new Error('invalid_payload');
  const page = payload as PncpPayload;
  if (!Array.isArray(page.data)) throw new Error('invalid_payload_data');

  const records = page.data.flatMap((raw): NormalizedProcurement[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as PncpRecord;
    const externalId = text(item.numeroControlePNCP);
    const agency = text(item.orgaoEntidade?.razaoSocial);
    const object = text(item.objetoCompra);
    if (!externalId || !agency || !object) return [];
    const cnpj = text(item.orgaoEntidade?.cnpj);
    const year = number(item.anoCompra);
    const sequence = number(item.sequencialCompra);
    const officialUrl =
      cnpj && year && sequence
        ? `https://pncp.gov.br/app/editais/${cnpj}/${year}/${sequence}`
        : (text(item.linkSistemaOrigem) ?? 'https://pncp.gov.br/app/editais');

    return [
      {
        externalId,
        agency,
        municipality: text(item.unidadeOrgao?.municipioNome),
        state: text(item.unidadeOrgao?.ufSigla),
        modality: text(item.modalidadeNome),
        status: text(item.situacaoCompraNome) ?? 'não informado',
        object,
        publishedAt: text(item.dataPublicacaoPncp),
        sessionAt: text(item.dataAberturaProposta),
        deadlineAt: text(item.dataEncerramentoProposta),
        totalValue: number(item.valorTotalEstimado),
        sourceUrl: officialUrl,
      },
    ];
  });

  return {
    records,
    page: number(page.numeroPagina) ?? 1,
    totalPages: number(page.totalPaginas) ?? 1,
    remainingPages: number(page.paginasRestantes) ?? 0,
  };
}

export async function fetchPncpPage(
  search: PncpSearch,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    baseUrl?: string;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const response = await fetcher(buildPncpSearchUrl(search, options.baseUrl), {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`pncp_http_${response.status}`);
  return parsePncpPage(await response.json());
}

/**
 * Percorre páginas sequencialmente para respeitar a fonte e manter o uso de
 * memória previsível. O limite evita que metadados incorretos do provedor
 * transformem uma coleta em loop infinito.
 */
export async function collectPncpPages(
  search: PncpSearch,
  options: {
    fetchPage?: (search: PncpSearch) => Promise<PncpPage>;
    maxPages?: number;
  } = {},
): Promise<PncpCollection> {
  const maxPages = options.maxPages ?? 20;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100)
    throw new Error('invalid_max_pages');

  const fetchPage =
    options.fetchPage ?? ((pageSearch) => fetchPncpPage(pageSearch));
  const firstPage = search.page ?? 1;
  let requestedPage = firstPage;
  let totalPages = firstPage;
  let pagesFetched = 0;
  const seenPages = new Set<number>();
  const byExternalId = new Map<string, NormalizedProcurement>();

  while (pagesFetched < maxPages) {
    const page = await fetchPage({ ...search, page: requestedPage });
    if (seenPages.has(page.page)) throw new Error('pncp_repeated_page');
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
  }

  return {
    records: [...byExternalId.values()],
    pagesFetched,
    totalPages,
    truncated: requestedPage <= totalPages && pagesFetched >= maxPages,
  };
}
