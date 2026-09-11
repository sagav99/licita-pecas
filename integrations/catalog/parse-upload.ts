import readXlsxFile from 'read-excel-file/node';
import {
  mapCatalogHeaders,
  rowsToCatalogItems,
  type CatalogImportItem,
} from '../../domain/catalog.ts';

export const MAX_CATALOG_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_CATALOG_ROWS = 10_000;

const allowedExtensions = new Set(['csv', 'xlsx']);

export type CatalogDatabaseItem = {
  sku: string;
  description: string;
  oem: string | null;
  manufacturer_code: string | null;
  brand: string | null;
  category: string | null;
  application: string | null;
  compatible_vehicles: string | null;
  part_type: string | null;
  originalidade: string | null;
  reference_price: number | null;
  stock: number | null;
  lead_time_days: number | null;
  active: true;
};

export class CatalogFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogFileError';
  }
}

function extensionOf(name: string) {
  return name.toLocaleLowerCase().split('.').pop() ?? '';
}

export function assertCatalogFile(name: string, size: number) {
  if (!allowedExtensions.has(extensionOf(name))) {
    throw new CatalogFileError('Envie um arquivo CSV ou XLSX.');
  }
  if (size <= 0) throw new CatalogFileError('O arquivo está vazio.');
  if (size > MAX_CATALOG_FILE_BYTES) {
    throw new CatalogFileError('O arquivo deve ter no máximo 15 MB.');
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const sample = text.slice(0, 4096);
  const delimiter =
    (sample.match(/;/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new CatalogFileError('O CSV contém aspas não fechadas.');
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}

function text(value: string | number | undefined, max: number) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function number(value: string | number | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const source = String(value ?? '')
    .trim()
    .replace(/\s/g, '');
  if (!source) return null;
  const normalized = source.includes(',')
    ? source.replace(/\./g, '').replace(',', '.')
    : source;
  const parsed = Number(normalized.replace(/[^0-9+.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDatabaseItem(item: CatalogImportItem): CatalogDatabaseItem {
  const leadTime = number(item.prazo_entrega_dias);
  return {
    sku: String(item.sku).trim().slice(0, 160),
    description: String(item.descricao).trim().slice(0, 2_000),
    oem: text(item.codigo_oem, 500),
    manufacturer_code: text(item.codigo_fabricante, 500),
    brand: text(item.marca, 300),
    category: text(item.categoria, 300),
    application: text(item.aplicacao, 2_000),
    compatible_vehicles: text(item.veiculos_ou_maquinas_compativeis, 2_000),
    part_type: text(item.tipo_peca, 300),
    originalidade: text(item.originalidade, 300),
    reference_price: number(item.preco_referencia),
    stock: number(item.estoque),
    lead_time_days:
      leadTime === null ? null : Math.max(0, Math.trunc(leadTime)),
    active: true,
  };
}

export async function parseCatalogUpload(name: string, bytes: Uint8Array) {
  assertCatalogFile(name, bytes.byteLength);
  let rows: unknown[][];
  try {
    rows =
      extensionOf(name) === 'csv'
        ? parseCsv(new TextDecoder('utf-8').decode(bytes))
        : await readXlsxFile(Buffer.from(bytes));
  } catch (error) {
    if (error instanceof CatalogFileError) throw error;
    throw new CatalogFileError(
      'Não foi possível ler o arquivo. Confira se ele é um CSV ou XLSX válido.',
    );
  }
  if (rows.length < 2) {
    throw new CatalogFileError('O arquivo não contém produtos para importar.');
  }
  if (rows.length - 1 > MAX_CATALOG_ROWS) {
    throw new CatalogFileError(
      `Importe no máximo ${MAX_CATALOG_ROWS.toLocaleString('pt-BR')} produtos por arquivo.`,
    );
  }
  const headers = rows[0].map((value) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '',
  );
  const mapping = mapCatalogHeaders(headers);
  if (!mapping.some((column) => column.target === 'sku')) {
    throw new CatalogFileError('Não encontramos uma coluna de SKU ou código.');
  }
  if (!mapping.some((column) => column.target === 'descricao')) {
    throw new CatalogFileError('Não encontramos uma coluna de descrição.');
  }
  const parsed = rowsToCatalogItems(rows, mapping).map(toDatabaseItem);
  const unique = [...new Map(parsed.map((item) => [item.sku, item])).values()];
  if (!unique.length) {
    throw new CatalogFileError(
      'Nenhuma linha possui SKU e descrição preenchidos.',
    );
  }
  return { items: unique, sourceRowCount: parsed.length };
}
