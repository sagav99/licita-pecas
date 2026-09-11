import type { NormalizedProcurement } from '../../../integrations/pncp/client.ts';

const discoveryPatterns = [
  /\bautopecas?\b/,
  /\bautomotiv[oa]s?\b/,
  /\bfrotas?\b/,
  /\bveiculos?\b/,
  /\bcaminh(?:ao|oes)\b/,
  /\bonibus\b/,
  /\bmaquinas? pesadas?\b/,
  /\btratores?\b/,
  /\bpneus?\b/,
  /\blubrificantes?\b/,
  /\bfiltros?\b/,
  /\bfreios?\b/,
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

/** Filtro de alta cobertura; a decisão comercial continua no motor de match. */
export function isLicitaPecasDiscoveryCandidate(
  procurement: Pick<NormalizedProcurement, 'object'>,
) {
  const object = normalize(procurement.object);
  return discoveryPatterns.some((pattern) => pattern.test(object));
}
