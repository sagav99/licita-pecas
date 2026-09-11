import type { NormalizedProcurement } from '../../../integrations/pncp/client.ts';

const discoveryTerms = [
  'autopec',
  'automotiv',
  'frota',
  'veicul',
  'caminh',
  'onibus',
  'maquina pesada',
  'maquinas pesadas',
  'trator',
  'pneu',
  'lubrificant',
  'filtro',
  'freio',
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
  return discoveryTerms.some((term) => object.includes(term));
}
