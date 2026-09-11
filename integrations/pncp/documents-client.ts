import { assertPdf, MAX_DOCUMENT_BYTES } from '../documents/pdf-reader.ts';

const PNCP_API_BASE_URL = 'https://pncp.gov.br/api/pncp';
const PNCP_HOST = 'pncp.gov.br';

export type PncpProcurementCoordinates = {
  cnpj: string;
  year: number;
  sequence: number;
};

export type PncpDocumentMetadata = {
  url: string;
  title: string;
  documentType: string;
  publishedAt: string | null;
  sequence: number;
};

type RawDocument = {
  url?: unknown;
  uri?: unknown;
  statusAtivo?: unknown;
  dataPublicacaoPncp?: unknown;
  sequencialDocumento?: unknown;
  titulo?: unknown;
  tipoDocumentoNome?: unknown;
};

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 500)
    : fallback;
}

function pncpUrl(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== PNCP_HOST)
    throw new Error('pncp_document_host_not_allowed');
  return url.toString();
}

function timestamp(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}-03:00`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parsePncpProcurementCoordinates(
  sourceUrl: string,
  externalId?: string,
): PncpProcurementCoordinates | null {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(
      /^\/app\/editais\/(\d{14})\/(\d{4})\/(\d+)\/?$/,
    );
    if (url.hostname === PNCP_HOST && match) {
      return {
        cnpj: match[1],
        year: Number(match[2]),
        sequence: Number(match[3]),
      };
    }
  } catch {
    // A identidade externa ainda pode fornecer coordenadas válidas.
  }
  const match = externalId?.match(/^(\d{14})-\d+-0*(\d+)\/(\d{4})$/);
  return match
    ? { cnpj: match[1], sequence: Number(match[2]), year: Number(match[3]) }
    : null;
}

export function buildPncpDocumentsUrl(
  coordinates: PncpProcurementCoordinates,
  baseUrl = PNCP_API_BASE_URL,
) {
  if (!/^\d{14}$/.test(coordinates.cnpj)) throw new Error('invalid_cnpj');
  if (!Number.isInteger(coordinates.year) || coordinates.year < 2000)
    throw new Error('invalid_procurement_year');
  if (!Number.isInteger(coordinates.sequence) || coordinates.sequence < 1)
    throw new Error('invalid_procurement_sequence');
  const url = new URL(
    `${baseUrl}/v1/orgaos/${coordinates.cnpj}/compras/${coordinates.year}/${coordinates.sequence}/arquivos`,
  );
  url.searchParams.set('pagina', '1');
  url.searchParams.set('tamanhoPagina', '50');
  return url;
}

export function parsePncpDocuments(payload: unknown): PncpDocumentMetadata[] {
  if (!Array.isArray(payload)) throw new Error('invalid_documents_payload');
  return payload.flatMap((value): PncpDocumentMetadata[] => {
    if (!value || typeof value !== 'object') return [];
    const raw = value as RawDocument;
    if (raw.statusAtivo !== true) return [];
    const url = pncpUrl(raw.url ?? raw.uri);
    const sequence = Number(raw.sequencialDocumento);
    if (!url || !Number.isInteger(sequence) || sequence < 1) return [];
    return [
      {
        url,
        title: cleanText(raw.titulo, `Documento ${sequence}`),
        documentType: cleanText(raw.tipoDocumentoNome, 'Documento'),
        publishedAt: timestamp(raw.dataPublicacaoPncp),
        sequence,
      },
    ];
  });
}

function documentPriority(document: PncpDocumentMetadata) {
  const value = `${document.documentType} ${document.title}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/termo de referencia/.test(value)) return 0;
  if (/edital|retifica/.test(value)) return 1;
  if (/anexo|especificacao|planilha/.test(value)) return 2;
  return 3;
}

export function prioritizePncpDocuments(
  documents: PncpDocumentMetadata[],
  limit = 3,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10)
    throw new Error('invalid_document_limit');
  return [...documents]
    .sort(
      (left, right) =>
        documentPriority(left) - documentPriority(right) ||
        right.sequence - left.sequence,
    )
    .slice(0, limit);
}

export type PncpRequestOptions = {
  fetcher?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
  attempts?: number;
};

export async function requestPncp(
  url: URL | string,
  options: PncpRequestOptions,
) {
  const fetcher = options.fetcher ?? fetch;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const attempts = options.attempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetcher(url, {
      headers: { Accept: 'application/pdf, application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return response;
    if (
      (response.status !== 429 && response.status < 500) ||
      attempt === attempts - 1
    )
      throw new Error(`pncp_document_http_${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 30_000)
        : ([2_000, 5_000][attempt] ?? 5_000),
    );
  }
  throw new Error('pncp_document_retry_exhausted');
}

export async function fetchPncpDocuments(
  coordinates: PncpProcurementCoordinates,
  options: PncpRequestOptions & { baseUrl?: string } = {},
) {
  const response = await requestPncp(
    buildPncpDocumentsUrl(coordinates, options.baseUrl),
    options,
  );
  if (response.status === 204) return [];
  return parsePncpDocuments(await response.json());
}

async function readBoundedBody(response: Response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES)
    throw new Error('document_too_large');
  if (!response.body) throw new Error('document_empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new Error('document_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function downloadPncpPdf(
  documentUrl: string,
  options: PncpRequestOptions = {},
) {
  const safeUrl = pncpUrl(documentUrl);
  if (!safeUrl) throw new Error('pncp_document_url_missing');
  const bytes = await readBoundedBody(await requestPncp(safeUrl, options));
  assertPdf(bytes);
  return bytes;
}

export async function sha256(input: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(input));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
