export const catalogFields = [
  'sku',
  'descricao',
  'codigo_oem',
  'codigo_fabricante',
  'marca',
  'categoria',
  'aplicacao',
  'veiculos_ou_maquinas_compativeis',
  'tipo_peca',
  'originalidade',
  'preco_referencia',
  'estoque',
  'prazo_entrega_dias',
] as const;

export type CatalogField = (typeof catalogFields)[number];

const aliases: Record<CatalogField, string[]> = {
  sku: ['sku', 'codigo', 'cod produto', 'codigo produto', 'referencia'],
  descricao: ['descricao', 'produto', 'nome', 'descricao produto'],
  codigo_oem: ['codigo oem', 'oem', 'cod oem', 'numero oem'],
  codigo_fabricante: [
    'codigo fabricante',
    'cod fabricante',
    'part number',
    'partnumber',
  ],
  marca: ['marca', 'fabricante'],
  categoria: ['categoria', 'grupo', 'familia'],
  aplicacao: ['aplicacao', 'aplicabilidade'],
  veiculos_ou_maquinas_compativeis: [
    'veiculos compativeis',
    'maquinas compativeis',
    'veiculo',
    'modelo veiculo',
  ],
  tipo_peca: ['tipo peca', 'tipo de peca'],
  originalidade: ['originalidade', 'qualidade', 'linha'],
  preco_referencia: ['preco referencia', 'preco venda', 'valor referencia'],
  estoque: ['estoque', 'saldo', 'quantidade estoque'],
  prazo_entrega_dias: ['prazo entrega dias', 'lead time', 'prazo entrega'],
};

const labels: Record<CatalogField, string> = {
  sku: 'SKU',
  descricao: 'Descrição',
  codigo_oem: 'Código OEM',
  codigo_fabricante: 'Código do fabricante',
  marca: 'Marca',
  categoria: 'Categoria',
  aplicacao: 'Aplicação',
  veiculos_ou_maquinas_compativeis: 'Veículos/máquinas compatíveis',
  tipo_peca: 'Tipo de peça',
  originalidade: 'Originalidade',
  preco_referencia: 'Preço de referência',
  estoque: 'Estoque',
  prazo_entrega_dias: 'Prazo de entrega',
};

export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapCatalogHeaders(headers: string[]) {
  return headers.map((source) => {
    const normalized = normalizeHeader(source);
    const target = catalogFields.find((field) =>
      aliases[field].includes(normalized),
    );
    return {
      source,
      target: target ?? null,
      targetLabel: target ? labels[target] : null,
    };
  });
}

export type CatalogImportItem = Partial<
  Record<CatalogField, string | number>
> & {
  sku: string;
  descricao: string;
};

export function rowsToCatalogItems(
  rows: unknown[][],
  mapping: ReturnType<typeof mapCatalogHeaders>,
): CatalogImportItem[] {
  return rows.slice(1).flatMap((row) => {
    const item: Partial<Record<CatalogField, string | number>> = {};
    mapping.forEach((column, index) => {
      if (!column.target) return;
      const value = row[index];
      if (typeof value === 'string' || typeof value === 'number') {
        item[column.target] = value;
      }
    });

    const sku = String(item.sku ?? '').trim();
    const descricao = String(item.descricao ?? '').trim();
    if (!sku || !descricao) return [];
    return [{ ...item, sku, descricao } as CatalogImportItem];
  });
}

export type MatchInput = {
  technical: number;
  volume: number;
  locality: number;
  deadline: number;
  requirements: number;
  hardBlock?: boolean;
  enoughData?: boolean;
};

export function calculateMatch(input: MatchInput) {
  if (input.enoughData === false)
    return { status: 'sem dados suficientes' as const, score: null };
  if (input.hardBlock)
    return {
      status: 'incompatível' as const,
      score: Math.min(input.technical, 49),
    };
  const score = Math.round(
    input.technical * 0.45 +
      input.volume * 0.15 +
      input.locality * 0.2 +
      input.deadline * 0.1 +
      input.requirements * 0.1,
  );
  if (score >= 80) return { status: 'compatível' as const, score };
  if (score >= 45) return { status: 'revisar' as const, score };
  return { status: 'incompatível' as const, score };
}
