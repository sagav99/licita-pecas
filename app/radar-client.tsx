'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import readXlsxFile from 'read-excel-file';
import {
  Bell,
  Bookmark,
  Building2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  PackageSearch,
  Mail,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  mapCatalogHeaders,
  rowsToCatalogItems,
  type CatalogImportItem,
} from '@/domain/catalog';

const opportunities = [
  {
    id: 'PE-014/2026',
    agency: 'Prefeitura de São José do Rio Preto',
    title:
      'Registro de preços para aquisição de peças para manutenção da frota municipal',
    location: 'São José do Rio Preto · SP',
    value: 'R$ 84.730',
    deadline: '12 set · 09:00',
    score: 92,
    status: 'Compatível',
    tags: ['Filtros', 'Freios', 'Linha diesel'],
    reason: '18 SKUs compatíveis por código OEM e aplicação',
    evidence:
      'Fornecimento de filtros e componentes de freio para veículos Mercedes-Benz e Volkswagen...',
  },
  {
    id: 'PR-208/2026',
    agency: 'SAMAE de Caxias do Sul',
    title: 'Aquisição parcelada de componentes elétricos e peças automotivas',
    location: 'Caxias do Sul · RS',
    value: 'R$ 126.400',
    deadline: '13 set · 14:00',
    score: 78,
    status: 'Revisar',
    tags: ['Elétrica', 'Lote misto'],
    reason: '9 SKUs aderentes; prazo de entrega precisa de confirmação',
    evidence:
      'Entrega em até 48 horas após a emissão da ordem de fornecimento...',
  },
  {
    id: 'CE-091/2026',
    agency: 'Prefeitura de Sobral',
    title: 'Contratação de oficina com fornecimento de peças e mão de obra',
    location: 'Sobral · CE',
    value: 'R$ 142.000',
    deadline: '16 set · 10:30',
    score: 34,
    status: 'Incompatível',
    tags: ['Serviço', 'Oficina'],
    reason: 'Objeto exige oficina própria e mão de obra local',
    evidence:
      'A contratada deverá manter oficina equipada no raio máximo de 15 km...',
  },
];

const tone: Record<string, string> = {
  Compatível: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Revisar: 'border-amber-200 bg-amber-50 text-amber-800',
  Incompatível: 'border-rose-200 bg-rose-50 text-rose-800',
};

type View = 'Radar' | 'Salvas' | 'Meu catálogo' | 'Alertas';

const navItems: Array<[LucideIcon, View]> = [
  [LayoutDashboard, 'Radar'],
  [Bookmark, 'Salvas'],
  [PackageSearch, 'Meu catálogo'],
  [Bell, 'Alertas'],
];

type RadarClientProps = {
  displayName: string;
  organizationName: string;
  initialCatalogCount: number;
  initialSaved: string[];
  initialWorkflow: Record<string, string>;
};

const catalogPreview = [
  ['FIL-001', 'Filtro de óleo diesel', 'OC-121', 'MANN-FILTER', '24', '2 dias'],
  [
    'PST-884',
    'Pastilha de freio dianteira',
    'OEM-884',
    'Fras-le',
    '12',
    '3 dias',
  ],
  ['AMP-220', 'Amortecedor dianteiro', 'COFAP-220', 'Cofap', '8', '4 dias'],
  ['COR-518', 'Correia dentada', 'CT-518', 'Continental', '31', '2 dias'],
];

function CatalogView({
  count,
  onImport,
}: {
  count: number;
  onImport: () => void;
}) {
  return (
    <div className="px-5 py-7 md:px-8 md:py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#527066]">
            Base de comparação
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">
            Meu catálogo
          </h1>
          <p className="mt-2 text-[#60716b]">
            Produtos usados para identificar compatibilidade técnica e prazo.
          </p>
        </div>
        <Button onClick={onImport} className="gap-2">
          <Upload className="h-4 w-4" /> Importar nova versão
        </Button>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {[
          [count.toLocaleString('pt-BR'), 'produtos ativos', PackageSearch],
          ['87%', 'com código OEM', FileCheck2],
          ['2,8 dias', 'prazo médio', Clock3],
        ].map(([value, label, Icon]) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-5">
            <Icon className="h-5 w-5 text-[#5b841b]" />
            <p className="mt-4 text-2xl font-extrabold tracking-tight">
              {String(value)}
            </p>
            <p className="text-sm text-[#687a74]">{String(label)}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-bold">Amostra do catálogo</h2>
            <p className="text-xs text-[#687a74]">
              Última conferência hoje, 08:42
            </p>
          </div>
          <Badge variant="outline">Catálogo comercial</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'SKU',
                  'Descrição',
                  'Código',
                  'Marca',
                  'Estoque',
                  'Entrega',
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogPreview.map((row) => (
                <TableRow key={row[0]}>
                  {row.map((cell, index) => (
                    <TableCell
                      key={`${row[0]}-${cell}`}
                      className={
                        index === 0 ? 'font-mono text-xs font-semibold' : ''
                      }
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Qualidade dos dados</h2>
            <p className="mt-1 text-sm text-[#687a74]">
              Campos que aumentam a precisão do match.
            </p>
          </div>
          <span className="text-lg font-extrabold">82%</span>
        </div>
        <Progress value={82} className="mt-4" />
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
          <TriangleAlert className="h-4 w-4" /> 164 produtos ainda não possuem
          aplicação por veículo.
        </p>
      </section>
    </div>
  );
}

function AlertsView() {
  const alertOptions = [
    [
      'Novo edital compatível',
      'Assim que uma oportunidade atingir seu perfil',
      true,
    ],
    [
      'Alteração em edital salvo',
      'Retificações, anexos e mudança de sessão',
      true,
    ],
    ['Prazo próximo', 'Lembrete 48 horas antes do encerramento', true],
    [
      'Itens reclassificados',
      'Quando novos dados mudarem o resultado do match',
      false,
    ],
  ] as const;
  return (
    <div className="px-5 py-7 md:px-8 md:py-8">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#527066]">
        Preferências
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">
        Alertas
      </h1>
      <p className="mt-2 text-[#60716b]">
        Escolha o que merece interromper sua rotina comercial.
      </p>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf2ef]">
              <Mail className="h-5 w-5 text-[#315d50]" />
            </div>
            <div>
              <h2 className="font-bold">E-mail</h2>
              <p className="text-sm text-[#687a74]">marina@autonorte.com.br</p>
            </div>
          </div>
          <div className="divide-y">
            {alertOptions.map(([title, description, enabled]) => (
              <div
                key={title}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-[#687a74]">{description}</p>
                </div>
                <Switch defaultChecked={enabled} aria-label={title} />
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl bg-[#f4f6f3] p-4 text-sm text-[#52665f]">
            Todo e-mail inclui link para a fonte oficial e opção de descadastro.
          </div>
        </section>

        <aside className="rounded-2xl bg-[#102923] p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Atividade recente</h2>
            <RefreshCw className="h-4 w-4 text-[#d7ff57]" />
          </div>
          <div className="mt-5 space-y-5">
            {[
              [
                'Hoje, 08:04',
                'Novo match 92/100',
                'Prefeitura de São José do Rio Preto',
              ],
              ['Ontem, 16:20', 'Prazo alterado', 'SAMAE de Caxias do Sul'],
              [
                'Ontem, 09:12',
                '3 itens reclassificados',
                'Prefeitura de Franca',
              ],
            ].map(([time, title, detail]) => (
              <div
                key={`${time}-${title}`}
                className="border-l border-[#536b64] pl-4"
              >
                <p className="text-xs text-[#8fa8a0]">{time}</p>
                <p className="mt-1 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#abc0b9]">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function RadarClient({
  displayName,
  organizationName,
  initialCatalogCount,
  initialSaved,
  initialWorkflow,
}: RadarClientProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [activeView, setActiveView] = useState<View>('Radar');
  const [selectedId, setSelectedId] = useState(opportunities[0].id);
  const [saved, setSaved] = useState<string[]>(initialSaved);
  const [workflow, setWorkflow] =
    useState<Record<string, string>>(initialWorkflow);
  const [catalogCount, setCatalogCount] = useState(initialCatalogCount);
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState<{
    name: string;
    rows: number;
    mapping: ReturnType<typeof mapCatalogHeaders>;
    file?: File;
    items?: CatalogImportItem[];
    phase?: 'ready' | 'sending' | 'done';
    error?: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase('pt-BR');
    return opportunities.filter((item) => {
      const matchesQuery = [
        item.title,
        item.agency,
        item.location,
        item.id,
        ...item.tags,
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalized);
      const matchesView = activeView !== 'Salvas' || saved.includes(item.id);
      return (
        matchesQuery &&
        matchesView &&
        (status === 'Todos' || item.status === status)
      );
    });
  }, [activeView, query, saved, status]);

  const selected =
    opportunities.find((item) => item.id === selectedId) ??
    filtered[0] ??
    opportunities[0];

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'filter_procurements',
          title: 'Filtrar licitações',
          description:
            'Filtra as oportunidades visíveis por texto e status de aderência.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              status: {
                type: 'string',
                enum: ['Todos', 'Compatível', 'Revisar', 'Incompatível'],
              },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute(input: unknown) {
            const value = input as { query?: string; status?: string };
            if (typeof value.query === 'string')
              setQuery(value.query.slice(0, 120));
            if (
              ['Todos', 'Compatível', 'Revisar', 'Incompatível'].includes(
                value.status ?? '',
              )
            )
              setStatus(value.status!);
            return {
              query: value.query ?? '',
              status: value.status ?? 'Todos',
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function handleCatalogFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImportState({
        name: file.name,
        rows: 0,
        mapping: [],
        error: 'O arquivo deve ter no máximo 5 MB.',
      });
      return;
    }
    try {
      let rows: unknown[][];
      if (file.name.toLocaleLowerCase().endsWith('.csv')) {
        const text = await file.text();
        rows = text
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => line.split(/[,;]/).map((cell) => cell.trim()));
      } else {
        rows = await readXlsxFile(file);
      }
      const headers = (rows[0] ?? []).map((cell) =>
        typeof cell === 'string' || typeof cell === 'number'
          ? String(cell)
          : '',
      );
      const mapping = mapCatalogHeaders(headers);
      const items = rowsToCatalogItems(rows, mapping);
      setImportState({
        name: file.name,
        rows: items.length,
        mapping,
        file,
        items,
        phase: 'ready',
      });
    } catch {
      setImportState({
        name: file.name,
        rows: 0,
        mapping: [],
        error:
          'Não foi possível ler o arquivo. Confira se é um CSV ou XLSX válido.',
      });
    }
  }

  function persistSaved(procurementId: string) {
    const wasSaved = saved.includes(procurementId);
    setSaved((current) =>
      wasSaved
        ? current.filter((id) => id !== procurementId)
        : [...current, procurementId],
    );
  }

  function persistWorkflow(procurementId: string, label: string) {
    setWorkflow((current) => ({ ...current, [procurementId]: label }));
  }

  function confirmCatalogImport() {
    if (!importState?.file || !importState.items?.length) return;
    setImportState((current) =>
      current ? { ...current, phase: 'sending', error: undefined } : current,
    );
    setCatalogCount((current) => current + importState.items!.length);
    setImportState((current) =>
      current ? { ...current, phase: 'done' } : current,
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f2] pb-20 text-[#14201d] lg:pb-0">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[244px_1fr]">
        <aside className="hidden border-r border-[#203831] bg-[#102923] px-5 py-6 text-white lg:flex lg:flex-col">
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7ff57] text-[#102923]">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[18px] font-extrabold tracking-[-0.04em]">
                LICITA PEÇAS
              </p>
              <p className="text-xs text-[#9db4ad]">Radar comercial</p>
            </div>
          </div>

          <nav aria-label="Navegação principal" className="space-y-1 text-sm">
            {navItems.map(([Icon, label]) => (
              <button
                key={String(label)}
                onClick={() => setActiveView(label)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium transition ${activeView === label ? 'bg-white/10 text-[#d7ff57]' : 'text-[#b9cbc5] hover:bg-white/5 hover:text-white'}`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {String(label)}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-[#9db4ad]">Catálogo ativo</span>
              <span className="text-xs font-bold text-[#d7ff57]">82%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[82%] rounded-full bg-[#d7ff57]" />
            </div>
            <p className="mt-3 text-sm font-semibold">
              {catalogCount.toLocaleString('pt-BR')} produtos
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#9db4ad]">
              Atualizado hoje, 08:42
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex h-[72px] items-center justify-between border-b border-[#dce2de] bg-white px-5 md:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#d7ff57] text-[#102923]">
                <Gauge className="h-5 w-5" />
              </div>
              <span className="font-extrabold tracking-tight">
                LICITA PEÇAS
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold">Olá, {displayName}</p>
              <p className="text-xs text-[#687a74]">
                {organizationName} · Plano Piloto
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden gap-2 sm:flex"
                    />
                  }
                >
                  <Upload className="h-4 w-4" /> Importar catálogo
                </DialogTrigger>
                <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                      Importar catálogo comercial
                    </DialogTitle>
                    <DialogDescription>
                      Envie CSV ou XLSX. Você confere o mapeamento antes de
                      qualquer importação.
                    </DialogDescription>
                  </DialogHeader>
                  <label className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-[#9baa95] bg-[#f5f8f3] px-6 py-10 text-center hover:border-[#6c8f21]">
                    <Upload className="mb-3 h-7 w-7 text-[#507719]" />
                    <span className="font-semibold">Escolha seu arquivo</span>
                    <span className="mt-1 text-xs text-[#6a7d76]">
                      CSV ou XLSX · até 5 MB · sem preço de custo
                    </span>
                    <input
                      className="sr-only"
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleCatalogFile}
                    />
                  </label>
                  {importState && (
                    <div aria-live="polite" className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{importState.name}</p>
                          <p className="text-xs text-[#6a7d76]">
                            {importState.rows} produtos encontrados
                          </p>
                        </div>
                        {!importState.error && importState.phase !== 'done' && (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            Arquivo lido
                          </Badge>
                        )}
                      </div>
                      {importState.phase === 'done' ? (
                        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                          {importState.rows} produtos importados e disponíveis
                          para o match.
                        </p>
                      ) : importState.error ? (
                        <p className="mt-3 text-sm text-rose-700">
                          {importState.error}
                        </p>
                      ) : (
                        <div className="mt-4 overflow-hidden rounded-lg border">
                          <div className="grid grid-cols-2 bg-[#eef2ef] px-3 py-2 text-xs font-semibold text-[#5e716a]">
                            <span>Coluna do arquivo</span>
                            <span>Campo Licita Peças</span>
                          </div>
                          {importState.mapping.slice(0, 8).map((item) => (
                            <div
                              key={item.source}
                              className="grid grid-cols-2 border-t px-3 py-2 text-sm"
                            >
                              <span>{item.source}</span>
                              <span
                                className={
                                  item.target
                                    ? 'font-medium text-[#173d34]'
                                    : 'text-amber-700'
                                }
                              >
                                {item.targetLabel ?? 'Ignorar / mapear'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setImportOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={
                        !importState ||
                        !!importState.error ||
                        importState.rows === 0 ||
                        importState.phase === 'sending' ||
                        importState.phase === 'done'
                      }
                      onClick={confirmCatalogImport}
                    >
                      {importState?.phase === 'sending'
                        ? 'Importando…'
                        : 'Confirmar importação'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" aria-label="Configurações">
                <Settings2 className="h-5 w-5" />
              </Button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#173d34] text-sm font-bold text-white">
                MN
              </div>
            </div>
          </header>

          {activeView === 'Meu catálogo' && (
            <CatalogView
              count={catalogCount}
              onImport={() => setImportOpen(true)}
            />
          )}
          {activeView === 'Alertas' && <AlertsView />}

          <div
            className={`${activeView === 'Meu catálogo' || activeView === 'Alertas' ? 'hidden' : ''} px-5 py-7 md:px-8 md:py-8`}
          >
            <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#527066]">
                  <span className="h-2 w-2 rounded-full bg-[#75c91f]" />{' '}
                  Monitoramento ativo
                </div>
                <h1 className="text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
                  {activeView === 'Salvas'
                    ? 'Oportunidades salvas'
                    : 'Oportunidades para decidir hoje'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-[#60716b] md:text-base">
                  {activeView === 'Salvas'
                    ? `${saved.length} oportunidades separadas para análise.`
                    : 'Encontramos 12 editais aderentes ao seu catálogo, região e capacidade de entrega.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  ['12', 'novas'],
                  ['4', 'prazos próximos'],
                  ['2', 'alteradas'],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-xl border border-[#dce2de] bg-white px-4 py-3 shadow-[0_1px_1px_rgb(20_32_29/3%)]"
                  >
                    <p className="text-xl font-extrabold tracking-tight">
                      {value}
                    </p>
                    <p className="whitespace-nowrap text-xs text-[#687a74]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#dce2de] bg-white p-3 shadow-[0_12px_36px_rgb(16_41_35/5%)] md:flex-row md:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-[#f3f5f2] px-4 py-3">
                <Search className="h-4 w-4 text-[#688078]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Buscar oportunidades"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#87948f]"
                  placeholder="Órgão, item, código OEM ou cidade"
                />
              </label>
              <div className="flex gap-2 overflow-x-auto">
                <button className="whitespace-nowrap rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium">
                  SP + 2 UFs
                </button>
                <select
                  aria-label="Filtrar por status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium"
                >
                  {['Todos', 'Compatível', 'Revisar', 'Incompatível'].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
                <button className="whitespace-nowrap rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium">
                  R$ 5 mil – 150 mil
                </button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-3">
                {filtered.map((item, index) => (
                  <article
                    key={item.id}
                    className={`group rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgb(16_41_35/8%)] ${selected.id === item.id ? 'border-[#9fc443] shadow-[inset_4px_0_0_#b7e132]' : 'border-[#dce2de]'}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={tone[item.status]}
                          >
                            {item.status}
                          </Badge>
                          <span className="text-xs font-medium text-[#6a7d76]">
                            {item.id}
                          </span>
                          <span className="text-xs text-[#a0aaa6]">PNCP</span>
                        </div>
                        <h2 className="max-w-3xl text-base font-bold leading-snug tracking-[-0.015em] md:text-lg">
                          {item.title}
                        </h2>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-[#5e716a]">
                          <Building2 className="h-3.5 w-3.5" /> {item.agency}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-black tracking-tight">
                            {item.score}
                            <span className="text-xs font-semibold text-[#7d8d87]">
                              /100
                            </span>
                          </p>
                          <p className="text-[11px] uppercase tracking-wider text-[#7d8d87]">
                            aderência
                          </p>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            persistSaved(item.id);
                          }}
                          aria-label={`${saved.includes(item.id) ? 'Remover' : 'Salvar'} ${item.id}`}
                          className={`grid h-10 w-10 place-items-center rounded-full border transition ${saved.includes(item.id) ? 'border-[#173d34] bg-[#173d34] text-[#d7ff57]' : 'border-[#dce2de] group-hover:border-[#173d34]'}`}
                        >
                          <Star
                            className={`h-4 w-4 ${saved.includes(item.id) ? 'fill-current' : ''}`}
                          />
                        </button>
                        <button
                          onClick={() => setSelectedId(item.id)}
                          aria-label={`Abrir ${item.id}`}
                          className="grid h-10 w-10 place-items-center rounded-full border border-[#dce2de] transition group-hover:border-[#173d34] group-hover:bg-[#173d34] group-hover:text-white"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="my-4 grid gap-2 border-y border-[#edf0ee] py-3 text-sm sm:grid-cols-3">
                      <span>
                        <b className="block text-xs font-medium text-[#81908b]">
                          Local
                        </b>
                        {item.location}
                      </span>
                      <span>
                        <b className="block text-xs font-medium text-[#81908b]">
                          Valor estimado
                        </b>
                        {item.value}
                      </span>
                      <span>
                        <b className="block text-xs font-medium text-[#81908b]">
                          Sessão
                        </b>
                        {item.deadline}
                      </span>
                    </div>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-[#24473e]">
                          <Sparkles className="h-4 w-4 text-[#6ba717]" />{' '}
                          {item.reason}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-[#edf2ef] px-2 py-1 text-xs text-[#52665f]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[#9b5b08]">
                        <Clock3 className="h-4 w-4" />{' '}
                        {index === 0
                          ? 'Faltam 2 dias'
                          : index === 1
                            ? 'Faltam 3 dias'
                            : 'Faltam 6 dias'}
                      </p>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
                    <PackageSearch className="mx-auto h-8 w-8 text-[#789088]" />
                    <p className="mt-3 font-semibold">
                      Nenhuma oportunidade neste filtro
                    </p>
                    <button
                      onClick={() => {
                        setQuery('');
                        setStatus('Todos');
                      }}
                      className="mt-2 text-sm font-semibold text-[#4c7212] underline"
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
              </div>

              <aside className="h-fit rounded-2xl bg-[#102923] p-5 text-white xl:sticky xl:top-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Por que apareceu?</p>
                  <ShieldCheck className="h-5 w-5 text-[#d7ff57]" />
                </div>
                <p className="mt-4 text-xl font-extrabold leading-tight tracking-[-0.025em]">
                  {selected.reason}
                </p>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex gap-3">
                    <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d7ff57]" />
                    <span>
                      <b className="block">Correspondência técnica</b>
                      <span className="text-[#abc0b9]">
                        OEM, marca e aplicação encontrados
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d7ff57]" />
                    <span>
                      <b className="block">Entrega atendida</b>
                      <span className="text-[#abc0b9]">
                        127 km dentro do seu raio
                      </span>
                    </span>
                  </div>
                </div>
                <blockquote className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-relaxed text-[#c9d6d2]">
                  “{selected.evidence}”
                </blockquote>
                <p className="mt-3 text-xs text-[#8fa8a0]">
                  Trecho do edital · pág. 18
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {['Avaliando', 'Vai disputar', 'Não atende', 'Perdida'].map(
                    (value) => (
                      <button
                        key={value}
                        onClick={() => persistWorkflow(selected.id, value)}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${workflow[selected.id] === value ? 'border-[#d7ff57] bg-[#d7ff57] text-[#102923]' : 'border-white/15 text-[#c9d6d2] hover:bg-white/10'}`}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
                <a
                  href="https://www.gov.br/pncp/pt-br"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block rounded-lg bg-[#d7ff57] px-4 py-2.5 text-center text-sm font-bold text-[#102923] hover:bg-[#c7ef4e]"
                >
                  Abrir fonte oficial
                </a>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-[#819b93]">
                  A fonte oficial prevalece. A análise não substitui leitura
                  jurídica.
                </p>
              </aside>
            </div>
          </div>
        </section>
      </div>
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-[#102923] px-2 py-2 text-white lg:hidden"
      >
        {navItems.map(([Icon, label]) => (
          <button
            key={label}
            onClick={() => setActiveView(label)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold ${activeView === label ? 'bg-white/10 text-[#d7ff57]' : 'text-[#abc0b9]'}`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label === 'Meu catálogo' ? 'Catálogo' : label}
          </button>
        ))}
      </nav>
    </main>
  );
}
