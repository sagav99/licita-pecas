'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
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
import type {
  AlertPreferencesInput,
  MatchFeedbackInput,
  OpportunityStateInput,
  SupplierProfileInput,
} from '@/app/actions';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';
import SupplierProfileView from '@/app/supplier-profile-view';
import MatchFeedbackPanel from '@/app/match-feedback-panel';

export type RadarOpportunity = {
  id: string;
  matchId: string;
  externalId: string;
  agency: string;
  title: string;
  location: string;
  state: string | null;
  value: string;
  totalValue: number | null;
  deadline: string;
  score: number | null;
  status: string;
  tags: string[];
  reason: string;
  reasons: string[];
  missing: string[];
  evidence: string;
  evidenceSourceUrl: string;
  evidenceType: 'document' | 'item' | 'object';
  sourceUrl: string;
  deadlineAt: string | null;
};

const tone: Record<string, string> = {
  Compatível: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Revisar: 'border-amber-200 bg-amber-50 text-amber-800',
  Incompatível: 'border-rose-200 bg-rose-50 text-rose-800',
  'Sem dados': 'border-slate-200 bg-slate-50 text-slate-700',
};

type View = 'Radar' | 'Salvas' | 'Meu catálogo' | 'Alertas' | 'Meu perfil';

const navItems: Array<[LucideIcon, View]> = [
  [LayoutDashboard, 'Radar'],
  [Bookmark, 'Salvas'],
  [PackageSearch, 'Meu catálogo'],
  [Bell, 'Alertas'],
  [Settings2, 'Meu perfil'],
];

type RadarClientProps = {
  displayName: string;
  email: string;
  organizationName: string;
  initialCatalogCount: number;
  initialCatalogItems: CatalogPreviewItem[];
  initialCatalogMetrics: CatalogMetrics;
  initialAlertPreferences: AlertPreferences;
  initialAlertActivity: AlertActivity[];
  initialSupplierProfile: SupplierProfileInput;
  initialSaved: string[];
  initialWorkflow: Record<string, string>;
  initialOpportunities: RadarOpportunity[];
  initialFeedback: Record<string, string>;
  updateAlertPreferencesAction: (
    input: AlertPreferencesInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateOpportunityStateAction: (
    input: OpportunityStateInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateSupplierProfileAction: (
    input: SupplierProfileInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  submitMatchFeedbackAction: (
    input: MatchFeedbackInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOutAction?: () => Promise<void>;
};

export type CatalogPreviewItem = {
  sku: string;
  description: string;
  code: string | null;
  brand: string | null;
  stock: number | null;
  leadTimeDays: number | null;
};

export type CatalogMetrics = {
  analyzedCount: number;
  withCodeCount: number;
  missingApplicationCount: number;
  averageLeadTimeDays: number | null;
  lastImportAt: string | null;
};

export type AlertPreferences = {
  emailEnabled: boolean;
  enabledTypes: string[];
};

export type AlertActivity = {
  id: string;
  type: string;
  sentAt: string | null;
  agency: string;
};

function workflowStatusFromLabel(
  label: string | undefined,
): OpportunityStateInput['workflowStatus'] {
  if (label === 'Avaliando') return 'avaliando';
  if (label === 'Vai disputar') return 'vai_disputar';
  if (label === 'Não atende') return 'nao_atende';
  if (label === 'Perdida') return 'perdida';
  return null;
}

function CatalogView({
  count,
  items,
  metrics,
  onImport,
}: {
  count: number;
  items: CatalogPreviewItem[];
  metrics: CatalogMetrics;
  onImport: () => void;
}) {
  const withCodePercent = metrics.analyzedCount
    ? Math.round((metrics.withCodeCount / metrics.analyzedCount) * 100)
    : 0;
  const qualityPercent = metrics.analyzedCount
    ? Math.round(
        ((metrics.analyzedCount - metrics.missingApplicationCount) /
          metrics.analyzedCount) *
          100,
      )
    : 0;
  const lastImport = metrics.lastImportAt
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(metrics.lastImportAt))
    : 'Nenhuma importação concluída';
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
          [`${withCodePercent}%`, 'com código técnico', FileCheck2],
          [
            metrics.averageLeadTimeDays === null
              ? '—'
              : `${metrics.averageLeadTimeDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`,
            'prazo médio informado',
            Clock3,
          ],
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
              Última importação: {lastImport}
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
              {items.map((item) => (
                <TableRow key={item.sku}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.code ?? 'Não informado'}</TableCell>
                  <TableCell>{item.brand ?? 'Não informada'}</TableCell>
                  <TableCell>
                    {item.stock === null
                      ? 'Não informado'
                      : item.stock.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {item.leadTimeDays === null
                      ? 'Não informado'
                      : `${item.leadTimeDays} dias`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!items.length && (
          <div className="border-t px-5 py-10 text-center">
            <p className="font-semibold">Seu catálogo ainda está vazio</p>
            <p className="mt-1 text-sm text-[#687a74]">
              Importe um CSV ou XLSX para iniciar a comparação técnica.
            </p>
            <Button onClick={onImport} className="mt-4 gap-2">
              <Upload className="h-4 w-4" /> Importar catálogo
            </Button>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Qualidade dos dados</h2>
            <p className="mt-1 text-sm text-[#687a74]">
              Campos que aumentam a precisão do match.
            </p>
          </div>
          <span className="text-lg font-extrabold">{qualityPercent}%</span>
        </div>
        <Progress value={qualityPercent} className="mt-4" />
        {metrics.missingApplicationCount > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
            <TriangleAlert className="h-4 w-4" />{' '}
            {metrics.missingApplicationCount.toLocaleString('pt-BR')} produtos
            ainda não possuem aplicação por veículo.
          </p>
        ) : (
          <p className="mt-3 text-sm text-emerald-800">
            {count
              ? 'Todos os produtos informam aplicação.'
              : 'A qualidade será calculada após a primeira importação.'}
          </p>
        )}
      </section>
    </div>
  );
}

function AlertsView({
  email,
  initialPreferences,
  activity,
  updatePreferences,
}: {
  email: string;
  initialPreferences: AlertPreferences;
  activity: AlertActivity[];
  updatePreferences: (
    input: AlertPreferencesInput,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alertOptions = [
    [
      'new_match',
      'Novo edital compatível',
      'Assim que uma oportunidade atingir seu perfil',
    ],
    [
      'procurement_changed',
      'Alteração em edital salvo',
      'Retificações, anexos e mudança de sessão',
    ],
    [
      'deadline_near',
      'Prazo próximo',
      'Lembrete 48 horas antes do encerramento',
    ],
    [
      'item_reclassified',
      'Itens reclassificados',
      'Quando novos dados mudarem o resultado do match',
    ],
  ] as const;

  async function persistPreferences(next: AlertPreferences, key: string) {
    setSaving(key);
    setError(null);
    try {
      const result = await updatePreferences(next);
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar a preferência.');
        return;
      }
      setPreferences(next);
    } catch {
      setError('Não foi possível salvar a preferência. Tente novamente.');
    } finally {
      setSaving(null);
    }
  }

  function activityLabel(type: string) {
    return (
      {
        new_match: 'Novo match',
        procurement_changed: 'Edital alterado',
        deadline_near: 'Prazo próximo',
        item_reclassified: 'Item reclassificado',
      }[type] ?? type
    );
  }
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
          <div className="flex items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf2ef]">
                <Mail className="h-5 w-5 text-[#315d50]" />
              </div>
              <div>
                <h2 className="font-bold">E-mail</h2>
                <p className="text-sm text-[#687a74]">{email}</p>
              </div>
            </div>
            <Switch
              checked={preferences.emailEnabled}
              disabled={saving !== null}
              onCheckedChange={(checked) =>
                void persistPreferences(
                  { ...preferences, emailEnabled: checked },
                  'email',
                )
              }
              aria-label="Ativar alertas por e-mail"
            />
          </div>
          <div className="divide-y">
            {alertOptions.map(([type, title, description]) => (
              <div
                key={type}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-[#687a74]">{description}</p>
                </div>
                <Switch
                  checked={preferences.enabledTypes.includes(type)}
                  disabled={!preferences.emailEnabled || saving !== null}
                  onCheckedChange={(checked) => {
                    const enabledTypes = checked
                      ? [...new Set([...preferences.enabledTypes, type])]
                      : preferences.enabledTypes.filter(
                          (enabledType) => enabledType !== type,
                        );
                    void persistPreferences(
                      { ...preferences, enabledTypes },
                      type,
                    );
                  }}
                  aria-label={title}
                />
              </div>
            ))}
          </div>
          {error && (
            <p aria-live="polite" className="mt-2 text-sm text-rose-700">
              {error}
            </p>
          )}
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
            {activity.map((item) => (
              <div key={item.id} className="border-l border-[#536b64] pl-4">
                <p className="text-xs text-[#8fa8a0]">
                  {item.sentAt
                    ? new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(item.sentAt))
                    : 'Pendente de envio'}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {activityLabel(item.type)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#abc0b9]">
                  {item.agency}
                </p>
              </div>
            ))}
            {!activity.length && (
              <div className="rounded-xl border border-white/10 p-4 text-sm text-[#abc0b9]">
                Nenhum alerta foi registrado ainda.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function RadarClient({
  displayName,
  email,
  organizationName,
  initialCatalogCount,
  initialCatalogItems,
  initialCatalogMetrics,
  initialAlertPreferences,
  initialAlertActivity,
  initialSupplierProfile,
  initialSaved,
  initialWorkflow,
  initialOpportunities: opportunities,
  initialFeedback,
  updateAlertPreferencesAction,
  updateOpportunityStateAction,
  updateSupplierProfileAction,
  submitMatchFeedbackAction,
  signOutAction,
}: RadarClientProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const [status, setStatus] = useState('Todos');
  const [ufFilter, setUfFilter] = useState('Todas');
  const [valueFilter, setValueFilter] = useState('Todos');
  const [deadlineFilter, setDeadlineFilter] = useState('Todos');
  const [scoreFilter, setScoreFilter] = useState('Todos');
  const [filterReferenceTime] = useState(() => Date.now());
  const [activeView, setActiveView] = useState<View>('Radar');
  const [supplierProfile, setSupplierProfile] = useState(
    initialSupplierProfile,
  );
  const [feedback, setFeedback] = useState(initialFeedback);
  const [selectedId, setSelectedId] = useState(opportunities[0]?.id ?? '');
  const [saved, setSaved] = useState<string[]>(initialSaved);
  const [workflow, setWorkflow] =
    useState<Record<string, string>>(initialWorkflow);
  const [opportunitiesSaving, setOpportunitiesSaving] = useState<string[]>([]);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [catalogCount, setCatalogCount] = useState(initialCatalogCount);
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState<{
    name: string;
    rows: number;
    mapping: ReturnType<typeof mapCatalogHeaders>;
    file?: File;
    items?: CatalogImportItem[];
    phase?: 'ready' | 'sending' | 'done';
    deduplicated?: boolean;
    error?: string;
  } | null>(null);
  const catalogQuality = initialCatalogMetrics.analyzedCount
    ? Math.round(
        ((initialCatalogMetrics.analyzedCount -
          initialCatalogMetrics.missingApplicationCount) /
          initialCatalogMetrics.analyzedCount) *
          100,
      )
    : 0;
  const catalogUpdatedAt = initialCatalogMetrics.lastImportAt
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
      }).format(new Date(initialCatalogMetrics.lastImportAt))
    : 'não importado';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase('pt-BR');
    return opportunities.filter((item) => {
      const matchesQuery = [
        item.title,
        item.agency,
        item.location,
        item.id,
        item.externalId,
        ...item.tags,
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalized);
      const matchesView = activeView !== 'Salvas' || saved.includes(item.id);
      const matchesUf = ufFilter === 'Todas' || item.state === ufFilter;
      const matchesValue =
        valueFilter === 'Todos' ||
        (item.totalValue !== null &&
          ((valueFilter === 'Até R$ 150 mil' && item.totalValue <= 150_000) ||
            (valueFilter === 'R$ 150–500 mil' &&
              item.totalValue > 150_000 &&
              item.totalValue <= 500_000) ||
            (valueFilter === 'Acima de R$ 500 mil' &&
              item.totalValue > 500_000)));
      const deadlineDays = Number(deadlineFilter);
      const deadlineTime = item.deadlineAt
        ? new Date(item.deadlineAt).getTime()
        : Number.NaN;
      const matchesDeadline =
        deadlineFilter === 'Todos' ||
        (Number.isFinite(deadlineTime) &&
          deadlineTime >= filterReferenceTime &&
          deadlineTime <= filterReferenceTime + deadlineDays * 86_400_000);
      const minimumScore = Number(scoreFilter);
      const matchesScore =
        scoreFilter === 'Todos' ||
        (item.score !== null && item.score >= minimumScore);
      return (
        matchesQuery &&
        matchesView &&
        matchesUf &&
        matchesValue &&
        matchesDeadline &&
        matchesScore &&
        (status === 'Todos' || item.status === status)
      );
    });
  }, [
    activeView,
    deadlineFilter,
    filterReferenceTime,
    opportunities,
    query,
    saved,
    scoreFilter,
    status,
    ufFilter,
    valueFilter,
  ]);

  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const availableStates = useMemo(
    () =>
      [
        ...new Set(
          opportunities.flatMap((item) => (item.state ? [item.state] : [])),
        ),
      ].sort(),
    [opportunities],
  );

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
    if (file.size > 15 * 1024 * 1024) {
      setImportState({
        name: file.name,
        rows: 0,
        mapping: [],
        error: 'O arquivo deve ter no máximo 15 MB.',
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

  async function persistSaved(procurementId: string) {
    const wasSaved = saved.includes(procurementId);
    const nextSaved = !wasSaved;
    setSaved((current) =>
      wasSaved
        ? current.filter((id) => id !== procurementId)
        : [...current, procurementId],
    );
    setOpportunitiesSaving((current) => [...current, procurementId]);
    setOpportunityError(null);
    try {
      const result = await updateOpportunityStateAction({
        procurementId,
        saved: nextSaved,
        workflowStatus: workflowStatusFromLabel(workflow[procurementId]),
      });
      if (!result.ok) throw new Error(result.error);
    } catch (error) {
      setSaved((current) =>
        wasSaved
          ? [...new Set([...current, procurementId])]
          : current.filter((id) => id !== procurementId),
      );
      setOpportunityError(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível salvar a oportunidade.',
      );
    } finally {
      setOpportunitiesSaving((current) =>
        current.filter((id) => id !== procurementId),
      );
    }
  }

  async function persistWorkflow(procurementId: string, label: string) {
    const previous = workflow[procurementId];
    const nextLabel = previous === label ? undefined : label;
    setWorkflow((current) => {
      if (nextLabel) return { ...current, [procurementId]: nextLabel };
      const next = { ...current };
      delete next[procurementId];
      return next;
    });
    setOpportunitiesSaving((current) => [...current, procurementId]);
    setOpportunityError(null);
    try {
      const result = await updateOpportunityStateAction({
        procurementId,
        saved: saved.includes(procurementId),
        workflowStatus: workflowStatusFromLabel(nextLabel),
      });
      if (!result.ok) throw new Error(result.error);
    } catch (error) {
      setWorkflow((current) => {
        if (previous) return { ...current, [procurementId]: previous };
        const next = { ...current };
        delete next[procurementId];
        return next;
      });
      setOpportunityError(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível atualizar a oportunidade.',
      );
    } finally {
      setOpportunitiesSaving((current) =>
        current.filter((id) => id !== procurementId),
      );
    }
  }

  async function confirmCatalogImport() {
    if (!importState?.file || !importState.items?.length) return;
    setImportState((current) =>
      current ? { ...current, phase: 'sending', error: undefined } : current,
    );
    try {
      const prepareResponse = await fetch('/api/catalog-imports/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: importState.file.name,
          size: importState.file.size,
        }),
      });
      const prepared = (await prepareResponse.json()) as {
        error?: string;
        path?: string;
        token?: string;
      };
      if (!prepareResponse.ok || !prepared.path || !prepared.token) {
        throw new Error(prepared.error || 'Não foi possível preparar o envio.');
      }
      const contentType = importState.file.name
        .toLocaleLowerCase()
        .endsWith('.csv')
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const { error: uploadError } = await createBrowserSupabaseClient()
        .storage.from('catalog-imports')
        .uploadToSignedUrl(prepared.path, prepared.token, importState.file, {
          contentType,
        });
      if (uploadError) throw new Error('O envio do arquivo não foi concluído.');
      const finalizeResponse = await fetch('/api/catalog-imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: prepared.path,
          originalName: importState.file.name,
        }),
      });
      const result = (await finalizeResponse.json()) as {
        error?: string;
        imported?: number;
        catalogCount?: number;
        deduplicated?: boolean;
      };
      if (!finalizeResponse.ok) throw new Error(result.error);
      setCatalogCount(result.catalogCount ?? catalogCount);
      setImportState((current) =>
        current
          ? {
              ...current,
              rows: result.imported ?? current.rows,
              phase: 'done',
              deduplicated: result.deduplicated,
            }
          : current,
      );
      router.refresh();
    } catch (error) {
      setImportState((current) =>
        current
          ? {
              ...current,
              phase: 'ready',
              error:
                error instanceof Error && error.message
                  ? error.message
                  : 'Não foi possível importar o catálogo.',
            }
          : current,
      );
    }
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
              <span className="text-xs font-bold text-[#d7ff57]">
                {catalogQuality}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#d7ff57]"
                style={{ width: `${catalogQuality}%` }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold">
              {catalogCount.toLocaleString('pt-BR')} produtos
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#9db4ad]">
              Atualizado: {catalogUpdatedAt}
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
              {signOutAction && (
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="hidden text-[#60716b] sm:inline-flex"
                  >
                    Sair
                  </Button>
                </form>
              )}
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
                      CSV ou XLSX · até 15 MB · sem preço de custo
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
                          {importState.deduplicated
                            ? 'Este arquivo já havia sido importado. Nenhum produto foi duplicado.'
                            : `${importState.rows} produtos importados e disponíveis para o match.`}
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
              <Button
                variant="ghost"
                size="icon"
                aria-label="Meu perfil"
                onClick={() => setActiveView('Meu perfil')}
              >
                <Settings2 className="h-5 w-5" />
              </Button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#173d34] text-sm font-bold text-white">
                {initials || 'LP'}
              </div>
            </div>
          </header>

          {activeView === 'Meu catálogo' && (
            <CatalogView
              count={catalogCount}
              items={initialCatalogItems}
              metrics={initialCatalogMetrics}
              onImport={() => setImportOpen(true)}
            />
          )}
          {activeView === 'Alertas' && (
            <AlertsView
              email={email}
              initialPreferences={initialAlertPreferences}
              activity={initialAlertActivity}
              updatePreferences={updateAlertPreferencesAction}
            />
          )}
          {activeView === 'Meu perfil' && (
            <SupplierProfileView
              initialProfile={supplierProfile}
              updateProfile={async (input) => {
                const result = await updateSupplierProfileAction(input);
                if (result.ok) setSupplierProfile(input);
                return result;
              }}
            />
          )}

          <div
            className={`${activeView === 'Meu catálogo' || activeView === 'Alertas' || activeView === 'Meu perfil' ? 'hidden' : ''} px-5 py-7 md:px-8 md:py-8`}
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
                    : `${opportunities.length} oportunidades comparadas com seu catálogo.`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  [String(opportunities.length), 'encontradas'],
                  [
                    String(
                      opportunities.filter(
                        (item) => item.status === 'Compatível',
                      ).length,
                    ),
                    'compatíveis',
                  ],
                  [
                    String(
                      opportunities.filter((item) => item.status === 'Revisar')
                        .length,
                    ),
                    'para revisar',
                  ],
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
                <select
                  aria-label="Filtrar por estado"
                  value={ufFilter}
                  onChange={(event) => setUfFilter(event.target.value)}
                  className="rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium"
                >
                  <option value="Todas">Todas as UFs</option>
                  {availableStates.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium"
                >
                  {[
                    'Todos',
                    'Compatível',
                    'Revisar',
                    'Incompatível',
                    'Sem dados',
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por valor"
                  value={valueFilter}
                  onChange={(event) => setValueFilter(event.target.value)}
                  className="rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium"
                >
                  {[
                    'Todos',
                    'Até R$ 150 mil',
                    'R$ 150–500 mil',
                    'Acima de R$ 500 mil',
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por prazo"
                  value={deadlineFilter}
                  onChange={(event) => setDeadlineFilter(event.target.value)}
                  className="rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium"
                >
                  <option value="Todos">Todos os prazos</option>
                  <option value="7">Próximos 7 dias</option>
                  <option value="15">Próximos 15 dias</option>
                  <option value="30">Próximos 30 dias</option>
                </select>
                <select
                  aria-label="Filtrar por score"
                  value={scoreFilter}
                  onChange={(event) => setScoreFilter(event.target.value)}
                  className="rounded-xl border border-[#dce2de] bg-white px-4 py-3 text-sm font-medium"
                >
                  <option value="Todos">Todos os scores</option>
                  <option value="80">Score 80+</option>
                  <option value="60">Score 60+</option>
                  <option value="40">Score 40+</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-3">
                {opportunityError && (
                  <p
                    aria-live="polite"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                  >
                    {opportunityError}
                  </p>
                )}
                {filtered.map((item) => (
                  <article
                    key={item.id}
                    className={`group rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgb(16_41_35/8%)] ${selected?.id === item.id ? 'border-[#9fc443] shadow-[inset_4px_0_0_#b7e132]' : 'border-[#dce2de]'}`}
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
                            {item.externalId}
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
                            {item.score ?? '—'}
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
                            void persistSaved(item.id);
                          }}
                          disabled={opportunitiesSaving.includes(item.id)}
                          aria-label={`${saved.includes(item.id) ? 'Remover' : 'Salvar'} ${item.externalId}`}
                          className={`grid h-10 w-10 place-items-center rounded-full border transition ${saved.includes(item.id) ? 'border-[#173d34] bg-[#173d34] text-[#d7ff57]' : 'border-[#dce2de] group-hover:border-[#173d34]'}`}
                        >
                          <Star
                            className={`h-4 w-4 ${saved.includes(item.id) ? 'fill-current' : ''}`}
                          />
                        </button>
                        <button
                          onClick={() => setSelectedId(item.id)}
                          aria-label={`Abrir ${item.externalId}`}
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
                        {item.deadlineAt
                          ? 'Confira o prazo oficial'
                          : 'Prazo não informado'}
                      </p>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
                    <PackageSearch className="mx-auto h-8 w-8 text-[#789088]" />
                    <p className="mt-3 font-semibold">
                      {opportunities.length === 0
                        ? 'Nenhum match gerado ainda'
                        : 'Nenhuma oportunidade neste filtro'}
                    </p>
                    <button
                      onClick={() => {
                        if (opportunities.length === 0)
                          setActiveView('Meu catálogo');
                        else {
                          setQuery('');
                          setStatus('Todos');
                          setUfFilter('Todas');
                          setValueFilter('Todos');
                          setDeadlineFilter('Todos');
                          setScoreFilter('Todos');
                        }
                      }}
                      className="mt-2 text-sm font-semibold text-[#4c7212] underline"
                    >
                      {opportunities.length === 0
                        ? 'Importe o catálogo e aguarde a próxima análise'
                        : 'Limpar filtros'}
                    </button>
                  </div>
                )}
              </div>

              {selected && (
                <aside className="h-fit rounded-2xl bg-[#102923] p-5 text-white xl:sticky xl:top-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Por que apareceu?</p>
                    <ShieldCheck className="h-5 w-5 text-[#d7ff57]" />
                  </div>
                  <p className="mt-4 text-xl font-extrabold leading-tight tracking-[-0.025em]">
                    {selected.reason}
                  </p>
                  {selected.reasons.length > 1 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-[#d7ff57]">
                        Outros motivos
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#c9d6d2]">
                        {selected.reasons.slice(1).map((reason, index) => (
                          <li key={`${index}-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.missing.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-200/10 p-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200">
                        Confirmar no edital
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-50">
                        {selected.missing.map((field, index) => (
                          <li key={`${index}-${field}`}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-5 space-y-3 text-sm">
                    <div className="flex gap-3">
                      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d7ff57]" />
                      <span>
                        <b className="block">Sinais considerados</b>
                        <span className="text-[#abc0b9]">
                          {selected.tags.length
                            ? selected.tags.join(' · ')
                            : 'Nenhum sinal adicional informado'}
                        </span>
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d7ff57]" />
                      <span>
                        <b className="block">Evidência disponível</b>
                        <span className="text-[#abc0b9]">
                          Confira o trecho abaixo e valide na fonte oficial
                        </span>
                      </span>
                    </div>
                  </div>
                  <blockquote className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-relaxed text-[#c9d6d2]">
                    “{selected.evidence}”
                  </blockquote>
                  <p className="mt-3 text-xs text-[#8fa8a0]">
                    {selected.evidenceType === 'document'
                      ? 'Trecho do documento oficial; confira o PDF completo'
                      : selected.evidenceType === 'item'
                        ? 'Descrição de item da fonte oficial'
                        : 'Objeto publicado na fonte oficial'}
                  </p>
                  {selected.evidenceSourceUrl &&
                    selected.evidenceSourceUrl !== selected.sourceUrl && (
                      <a
                        href={selected.evidenceSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-[#d7ff57] underline underline-offset-4"
                      >
                        Abrir fonte da evidência
                      </a>
                    )}
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {['Avaliando', 'Vai disputar', 'Não atende', 'Perdida'].map(
                      (value) => (
                        <button
                          key={value}
                          onClick={() =>
                            void persistWorkflow(selected.id, value)
                          }
                          disabled={opportunitiesSaving.includes(selected.id)}
                          className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${workflow[selected.id] === value ? 'border-[#d7ff57] bg-[#d7ff57] text-[#102923]' : 'border-white/15 text-[#c9d6d2] hover:bg-white/10'}`}
                        >
                          {value}
                        </button>
                      ),
                    )}
                  </div>
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block rounded-lg bg-[#d7ff57] px-4 py-2.5 text-center text-sm font-bold text-[#102923] hover:bg-[#c7ef4e]"
                  >
                    Abrir fonte oficial
                  </a>
                  <MatchFeedbackPanel
                    key={selected.matchId}
                    matchId={selected.matchId}
                    initialRating={
                      (feedback[
                        selected.matchId
                      ] as MatchFeedbackInput['rating']) ?? null
                    }
                    submit={async (input) => {
                      const result = await submitMatchFeedbackAction(input);
                      if (result.ok)
                        setFeedback((current) => ({
                          ...current,
                          [input.matchId]: input.rating,
                        }));
                      return result;
                    }}
                  />
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-[#819b93]">
                    A fonte oficial prevalece. A análise não substitui leitura
                    jurídica.
                  </p>
                </aside>
              )}
            </div>
          </div>
        </section>
      </div>
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-[#102923] px-2 py-2 text-white lg:hidden"
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
