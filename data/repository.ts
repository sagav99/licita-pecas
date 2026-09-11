export type SavedOpportunity = {
  organizationId: string;
  procurementId: string;
  workflow: 'avaliando' | 'vai disputar' | 'não atende' | 'perdida';
};

export interface OpportunityRepository {
  listSaved(organizationId: string): Promise<SavedOpportunity[]>;
  save(item: SavedOpportunity): Promise<void>;
  remove(organizationId: string, procurementId: string): Promise<void>;
}

/** Implementação determinística para testes e desenvolvimento local. */
export function createMemoryOpportunityRepository(
  initial: SavedOpportunity[] = [],
): OpportunityRepository {
  const items = new Map(
    initial.map((item) => [key(item.organizationId, item.procurementId), item]),
  );
  return {
    async listSaved(organizationId) {
      return [...items.values()].filter(
        (item) => item.organizationId === organizationId,
      );
    },
    async save(item) {
      items.set(key(item.organizationId, item.procurementId), item);
    },
    async remove(organizationId, procurementId) {
      items.delete(key(organizationId, procurementId));
    },
  };
}

function key(organizationId: string, procurementId: string) {
  return `${organizationId}:${procurementId}`;
}
