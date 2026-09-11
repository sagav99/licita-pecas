import { createGeminiExtractionAdapter } from '../integrations/gemini/adapter.ts';
import { createGoogleGeminiClientFromEnv } from '../integrations/gemini/google-client.ts';

const sourceUrl = 'https://pncp.gov.br/app/editais/exemplo';
const publicFixture = `
Órgão: Prefeitura Municipal de Exemplo/SP.
Objeto: aquisição de 20 filtros de óleo automotivo, código OEM ABC-123.
Sessão pública: 15/09/2026 às 09:00, horário de Brasília.
Entrega: almoxarifado municipal em até 10 dias corridos.
`;

const adapter = createGeminiExtractionAdapter(
  createGoogleGeminiClientFromEnv(),
);
const result = await adapter.extract({ sourceUrl, text: publicFixture });

console.log(
  JSON.stringify({
    connected: true,
    objectExtracted: Boolean(result.object),
    evidenceCount: result.evidence.length,
  }),
);
