export const MAX_STRUCTURING_CHARACTERS = 100_000;

const CHUNK_CHARACTERS = 2_500;
const LEADING_CHUNKS = 4;
const TRAILING_CHUNKS = 1;
const SEPARATOR = '\n\n[trecho intermediário omitido para análise parcial]\n\n';
const SIGNAL =
  /\b(?:autopeças?|peças?|filtros?|freios?|amortecedores?|correias?|pneus?|lubrificantes?|veículos?|caminhões?|ônibus|tratores?|máquinas?|motores?|marca|modelo|fabricante|oem|código|catálogo|equivalente|original|genuín[oa]|lotes?|itens?|quantidade|entrega|prazo|garantia|amostra|atestado|habilitação)\b/giu;

export type StructuringText = {
  text: string;
  scope: 'full' | 'selected_excerpts';
  originalCharacters: number;
};

/** Seleciona trechos contíguos e rastreáveis; o PDF e o texto integral permanecem salvos. */
export function selectStructuringText(text: string): StructuringText {
  if (text.length <= MAX_STRUCTURING_CHARACTERS)
    return { text, scope: 'full', originalCharacters: text.length };

  const chunks = Array.from(
    { length: Math.ceil(text.length / CHUNK_CHARACTERS) },
    (_, index) => {
      const start = index * CHUNK_CHARACTERS;
      const value = text.slice(start, start + CHUNK_CHARACTERS);
      return {
        index,
        value,
        score: [...value.matchAll(SIGNAL)].length,
      };
    },
  );
  const separatorBudget = chunks.length * SEPARATOR.length;
  const chunkLimit = Math.max(
    1,
    Math.floor(
      (MAX_STRUCTURING_CHARACTERS - separatorBudget) / CHUNK_CHARACTERS,
    ),
  );
  const selected = new Set<number>();
  for (let index = 0; index < LEADING_CHUNKS; index += 1) selected.add(index);
  for (
    let index = Math.max(0, chunks.length - TRAILING_CHUNKS);
    index < chunks.length;
    index += 1
  )
    selected.add(index);
  for (const chunk of [...chunks].sort(
    (left, right) => right.score - left.score || left.index - right.index,
  )) {
    if (selected.size >= chunkLimit) break;
    selected.add(chunk.index);
  }
  const chosen = [...selected].sort((left, right) => left - right);
  const excerpt = chosen
    .map((index, position) => {
      const previous = chosen[position - 1];
      const prefix =
        previous === undefined || previous === index - 1 ? '' : SEPARATOR;
      return prefix + chunks[index]!.value;
    })
    .join('');
  return {
    text: excerpt.slice(0, MAX_STRUCTURING_CHARACTERS),
    scope: 'selected_excerpts',
    originalCharacters: text.length,
  };
}

export function retainVerifiedDocumentEvidence<
  T extends {
    evidence: Array<{ quote: string }>;
  },
>(result: T, originalText: string): T {
  const normalizedText = originalText.replace(/\s+/g, ' ').toLowerCase();
  const evidence = result.evidence.filter((item) => {
    const quote = item.quote.replace(/\s+/g, ' ').trim().toLowerCase();
    return quote.length >= 8 && normalizedText.includes(quote);
  });
  if (!evidence.length) throw new Error('document_unverified_evidence');
  return { ...result, evidence };
}
