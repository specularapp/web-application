"use client";

import styled from "@emotion/styled";
import {
  ArrowClockwiseIcon,
  ChartBarIcon,
  ChatTextIcon,
  ClockIcon,
  CopyIcon,
  CopySimpleIcon,
  EnvelopeSimpleIcon,
  FlagIcon,
  LightningIcon,
  LinkIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  WhatsappLogoIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar, type PageToolbarFilter } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { slugify } from "@/lib/utils/slug";
import { DAY, HOUR, channelLabels, dateTimeLabel, eventLabels, fillSurveyText, formatCount, formatShare, plural, sendStatusLabels, serviceLabels } from "../labels";
import type { DispatchRule, NpsChannel, NpsData, NpsSend, SendStatus } from "../types";
import styles from "./dispatch.module.css";
import { NPS_BASE, surveyLink } from "./parts";
import { blankRule, delayLabel, RuleDialog } from "./rule-dialog";
import { Segmented } from "./segmented";
import { SendDialog } from "./send-dialog";

type View = "rules" | "sends" | "queue" | "metrics";
type MetricsPeriod = "30" | "90" | "365";

const PAGE_SIZE = 20;
const channelGlyphs: Record<NpsChannel, Icon> = { email: EnvelopeSimpleIcon, whatsapp: WhatsappLogoIcon, link: LinkIcon };
const channelHues: Record<NpsChannel, string> = { email: "var(--sys-blue)", whatsapp: "var(--color-whatsapp)", link: "var(--sys-gray)" };
const filterableStatuses: SendStatus[] = ["sent", "delivered", "read", "answered", "failed", "cancelled"];
const buckets = [
  { label: "Até 1 hora", max: 1 },
  { label: "De 1 a 6 horas", max: 6 },
  { label: "De 6 a 24 horas", max: 24 },
  { label: "De 1 a 3 dias", max: 72 },
  { label: "Mais de 3 dias", max: Number.POSITIVE_INFINITY },
];

const CardButton = styled.button`
  display: grid;
  gap: var(--space-3);
  width: 100%;
  height: 100%;
  padding: var(--space-4);
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
  background: none;
  border: 0;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &:hover {
    background-color: var(--color-fill-quaternary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const share = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

function ShareRow({ label, hue, value, base, extra, icon: Glyph }: { label: string; hue: string; value: number; base: number; extra?: string; icon?: Icon }) {
  const percent = share(value, base);
  return (
    <li className={styles.shareRow} aria-label={`${label}: ${formatCount(value)} de ${formatCount(base)}, ${formatShare(percent)}`}>
      <span className={styles.shareHead} aria-hidden="true">
        {Glyph && <Glyph style={{ color: hue }} />}
        <span className={styles.shareLabel}>{label}</span>
        <strong>{formatShare(percent)}</strong>
        <small>{extra ?? `${formatCount(value)} de ${formatCount(base)}`}</small>
      </span>
      <span className={styles.shareTrack} aria-hidden="true">
        <i style={{ width: `${percent}%`, "--bar": hue } as CSSProperties} />
      </span>
    </li>
  );
}

/**
 * Os disparos do NPS em quatro abas: as regras que mandam a pesquisa sozinhas, os envios que já saíram, a fila
 * do que vai sair e as métricas do caminho do envio à resposta. No topo, o envio avulso e a regra nova.
 */
export function DispatchBoard({ data }: { data: NpsData }) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("rules");
  const [rules, setRules] = useState(data.rules);
  const [sends, setSends] = useState(data.sends);
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<SendStatus[]>([]);
  const [channel, setChannel] = useState<NpsChannel | "all">("all");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<MetricsPeriod>("90");
  const [editing, setEditing] = useState<DispatchRule | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<DispatchRule | null>(null);

  const clientsById = useMemo(() => new Map(data.clients.map((client) => [client.id, client])), [data.clients]);
  const surveyNames = useMemo(() => new Map(data.surveys.map((survey) => [survey.id, survey.name])), [data.surveys]);
  const surveyName = (id: string) => surveyNames.get(id) ?? "Pesquisa";
  const ruleName = (id: string | null) => (id ? (rules.find((rule) => rule.id === id)?.name ?? "Regra removida") : "Envio manual");
  const now = Date.parse(data.now);

  const sent = useMemo(() => sends.filter((send) => send.status !== "scheduled"), [sends]);
  const queue = useMemo(() => sends.filter((send) => send.status === "scheduled").toSorted((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), [sends]);

  const rows = useMemo(() => {
    const term = slugify(search.trim(), 80);
    const base = view === "queue" ? queue : sent;
    return base.filter((send) => {
      const client = clientsById.get(send.clientId);
      if (term && !slugify(`${client?.contact.name} ${client?.contact.company} ${client?.contact.email} ${client?.project.name}`, 300).includes(term)) return false;
      if (view === "sends" && statuses.length > 0 && !statuses.includes(send.status)) return false;
      if (channel !== "all" && send.channel !== channel) return false;
      return true;
    });
  }, [view, queue, sent, search, statuses, channel, clientsById]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const visibleRules = useMemo(() => {
    const term = slugify(search.trim(), 80);
    return rules.filter((rule) => !term || slugify(`${rule.name} ${rule.message} ${surveyNames.get(rule.surveyId) ?? ""}`, 300).includes(term));
  }, [rules, search, surveyNames]);

  const ruleStats = (id: string) => {
    const list = sent.filter((send) => send.ruleId === id && send.sentAt && now - Date.parse(send.sentAt) < 30 * DAY);
    return { sent: list.length, answered: list.filter((send) => send.status === "answered").length };
  };

  const changeView = (next: View) => {
    setView(next);
    setPage(1);
    setSearch("");
  };

  const openEditor = (rule: DispatchRule) => {
    setEditorKey((key) => key + 1);
    setEditing(rule);
  };

  const saveRule = (rule: DispatchRule) => {
    const exists = rules.some((item) => item.id === rule.id);
    setRules((current) => (exists ? current.map((item) => (item.id === rule.id ? rule : item)) : [...current, rule]));
    setEditing(null);
    toast({ title: exists ? "Regra salva" : "Regra criada", description: rule.active ? `${delayLabel(rule.delayHours)} ${eventLabels[rule.event].after}.` : "Ela fica desligada até você ligar.", tone: "success", feedback: false });
  };

  const toggleRule = (rule: DispatchRule) => {
    setRules((current) => current.map((item) => (item.id === rule.id ? { ...item, active: !item.active } : item)));
    toast({ title: rule.active ? "Regra desligada" : "Regra ligada", description: rule.active ? "Os próximos eventos não disparam a pesquisa." : "Os próximos eventos já disparam a pesquisa.", tone: "success", feedback: false });
  };

  const copy = async (send: NpsSend) => {
    const url = surveyLink(send.id.replace("n-", ""));
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "O link é pessoal e aceita uma resposta.", tone: "success", feedback: false });
    } catch {
      toast({ title: "Link da pesquisa", description: url, tone: "neutral" });
    }
  };

  const updateSend = (id: string, patch: Partial<NpsSend>) => setSends((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const ruleMenu = (rule: DispatchRule): DropdownSection[] => [
    { id: "open", items: [{ id: "edit", label: "Editar regra", icon: PencilSimpleIcon, onSelect: () => openEditor(rule) }] },
    { id: "state", label: "Situação", items: [{ id: "toggle", label: rule.active ? "Desligar" : "Ligar", icon: PowerIcon, onSelect: () => toggleRule(rule) }] },
    { id: "more", label: "Mais ações", items: [{ id: "duplicate", label: "Duplicar", icon: CopyIcon, onSelect: () => openEditor({ ...rule, id: `${rule.id}-copia-${rules.length + 1}`, name: `${rule.name} (cópia)`, active: false }) }] },
    { id: "danger", items: [{ id: "delete", label: "Excluir regra", icon: TrashIcon, tone: "danger", onSelect: () => setRemoving(rule) }] },
  ];

  const sendMenu = (send: NpsSend): DropdownSection[] => {
    const name = clientsById.get(send.clientId)?.contact.name ?? "O cliente";
    return [
      {
        id: "open",
        items: [
          { id: "copy", label: "Copiar link pessoal", icon: CopySimpleIcon, onSelect: () => void copy(send) },
          ...(send.responseId ? [{ id: "response", label: "Ver a resposta", icon: ChatTextIcon, href: `${NPS_BASE}/respostas?id=${send.responseId}` as Route }] : []),
        ],
      },
      ...(send.status === "failed" || send.status === "delivered" || send.status === "read" || send.status === "sent"
        ? [{ id: "resend", label: "Envio", items: [{ id: "resend", label: send.status === "failed" ? "Tentar de novo" : "Mandar lembrete", icon: ArrowClockwiseIcon, onSelect: () => { updateSend(send.id, { status: "sent", reminded: send.status !== "failed" || send.reminded, error: "", sentAt: data.now }); toast({ title: send.status === "failed" ? "Envio refeito" : "Lembrete enviado", description: `${name} recebe a pesquisa de novo.`, tone: "success", feedback: false }); } }] }]
        : []),
      ...(send.status === "scheduled"
        ? [{ id: "danger", items: [{ id: "cancel", label: "Cancelar envio", icon: XCircleIcon, tone: "danger" as const, onSelect: () => { updateSend(send.id, { status: "cancelled" }); toast({ title: "Envio cancelado", description: `${name} não vai receber a pesquisa.`, tone: "success", feedback: false }); } }] }]
        : []),
    ];
  };

  const columns: DataTableColumn<NpsSend>[] = [
    {
      id: "client",
      header: "Cliente",
      sortable: true,
      sortValue: (send) => clientsById.get(send.clientId)?.contact.name ?? "",
      cell: (send) => {
        const client = clientsById.get(send.clientId);
        return <DataTableTitle title={client?.contact.name ?? "Cliente"} caption={client?.contact.company} media={<Avatar name={client?.contact.name ?? "Cliente"} seed={send.clientId} size="sm" />} />;
      },
    },
    { id: "project", header: "Projeto", hideBelow: "lg", cell: (send) => <Text as="span" variant="footnote" tone="secondary">{clientsById.get(send.clientId)?.project.name}</Text> },
    {
      id: "channel",
      header: "Canal",
      cell: (send) => {
        const Glyph = channelGlyphs[send.channel];
        return (
          <span className={styles.inline}>
            <Glyph aria-hidden="true" style={{ color: channelHues[send.channel] }} />
            {channelLabels[send.channel]}
          </span>
        );
      },
    },
    { id: "origin", header: "Origem", hideBelow: "lg", cell: (send) => <Text as="span" variant="footnote" tone="secondary">{ruleName(send.ruleId)}</Text> },
    { id: "date", header: view === "queue" ? "Sai em" : "Enviado em", sortable: true, sortValue: (send) => send.sentAt ?? send.scheduledAt, cell: (send) => <Text as="span" variant="footnote" tone="secondary">{dateTimeLabel(send.sentAt ?? send.scheduledAt)}</Text> },
    {
      id: "status",
      header: "Situação",
      cell: (send) => (
        <span className={styles.badges} title={send.error || undefined}>
          <Badge tone={sendStatusLabels[send.status].tone} size="sm">
            {sendStatusLabels[send.status].label}
          </Badge>
          {send.reminded && (
            <Badge tone="neutral" variant="outline" size="sm">
              Lembrete
            </Badge>
          )}
        </span>
      ),
    },
  ];

  const metrics = useMemo(() => {
    const days = Number(period);
    const list = sends.filter((send) => send.sentAt && send.status !== "scheduled" && send.status !== "cancelled" && now - Date.parse(send.sentAt) < days * DAY);
    const counts = (items: NpsSend[]) => ({
      sent: items.length,
      delivered: items.filter((send) => send.status !== "sent" && send.status !== "failed").length,
      read: items.filter((send) => send.status === "read" || send.status === "answered").length,
      answered: items.filter((send) => send.status === "answered").length,
      failed: items.filter((send) => send.status === "failed").length,
    });
    const responsesById = new Map(data.responses.map((response) => [response.id, response]));
    const waits = list.flatMap((send) => {
      const response = send.responseId ? responsesById.get(send.responseId) : null;
      return response && send.sentAt ? [(Date.parse(response.answeredAt) - Date.parse(send.sentAt)) / HOUR] : [];
    });
    const reminded = list.filter((send) => send.reminded);
    const notReminded = list.filter((send) => !send.reminded);
    return {
      total: counts(list),
      channels: (["email", "whatsapp"] as NpsChannel[]).map((item) => ({ channel: item, ...counts(list.filter((send) => send.channel === item)) })),
      perRule: [...rules.map((rule) => ({ id: rule.id, name: rule.name, ...counts(list.filter((send) => send.ruleId === rule.id)) })), { id: "manual", name: "Envio manual", ...counts(list.filter((send) => send.ruleId === null)) }].filter((row) => row.sent > 0),
      waits: buckets.map((bucket, index) => ({ label: bucket.label, count: waits.filter((wait) => wait <= bucket.max && (index === 0 || wait > buckets[index - 1].max)).length })),
      waitTotal: waits.length,
      reminder: { with: counts(reminded), without: counts(notReminded) },
      failures: list.filter((send) => send.status === "failed").reduce<Record<string, number>>((all, send) => ({ ...all, [send.error || "Sem motivo"]: (all[send.error || "Sem motivo"] ?? 0) + 1 }), {}),
    };
  }, [sends, rules, period, now, data.responses]);

  const activeFilters: PageToolbarFilter[] = [
    ...statuses.map((status) => ({ id: `status-${status}`, label: sendStatusLabels[status].label, icon: FlagIcon, onClear: () => setStatuses((list) => list.filter((item) => item !== status)) })),
    ...(channel === "all" ? [] : [{ id: "channel", label: channelLabels[channel], icon: channelGlyphs[channel], onClear: () => setChannel("all") }]),
  ];
  const filtering = Boolean(search.trim()) || activeFilters.length > 0;
  const clear = () => {
    setSearch("");
    setStatuses([]);
    setChannel("all");
  };

  const filterSections: DropdownSection[] = [
    ...(view === "sends"
      ? [
          {
            id: "status",
            label: "Situação",
            items: filterableStatuses.map((status) => ({ kind: "toggle" as const, id: `status-${status}`, label: sendStatusLabels[status].label, icon: FlagIcon, checked: statuses.includes(status), onChange: (on: boolean) => { setPage(1); setStatuses((list) => (on ? [...list, status] : list.filter((item) => item !== status))); } })),
          },
        ]
      : []),
    {
      id: "channel",
      label: "Canal",
      items: (["all", "email", "whatsapp", "link"] as const).map((value) => ({ id: `channel-${value}`, label: value === "all" ? "Todos os canais" : channelLabels[value], icon: value === "all" ? PaperPlaneTiltIcon : channelGlyphs[value], selected: channel === value, keepOpen: true, onSelect: () => { setPage(1); setChannel(value); } })),
    },
  ];

  const tabs = [
    { value: "rules" as const, label: "Regras", icon: <LightningIcon aria-hidden="true" />, count: rules.length },
    { value: "sends" as const, label: "Envios", icon: <PaperPlaneTiltIcon aria-hidden="true" />, count: sent.length },
    { value: "queue" as const, label: "Fila", icon: <ClockIcon aria-hidden="true" />, count: queue.length },
    { value: "metrics" as const, label: "Métricas", icon: <ChartBarIcon aria-hidden="true" /> },
  ];

  return (
    <div className={styles.board}>
      <div className={styles.top}>
        <Segmented label="Partes dos disparos" value={view} onChange={changeView} options={tabs} controls="nps-disparos" />
        <span className={styles.topActions}>
          <Button size="sm" radius="md" variant="outline" iconStart={<PaperPlaneTiltIcon />} onClick={() => setSending(true)}>
            Enviar pesquisa
          </Button>
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor(blankRule(data.surveys, rules.length + 1))}>
            Nova regra
          </Button>
        </span>
      </div>

      <div className={styles.panel} id="nps-disparos" role="tabpanel" aria-label={tabs.find((tab) => tab.value === view)?.label}>
        {view !== "metrics" && (
          <PageToolbar
            search={{ value: search, onChange: (value) => { setSearch(value); setPage(1); }, placeholder: view === "rules" ? "Buscar regra, mensagem ou pesquisa" : "Buscar cliente, empresa ou projeto", label: view === "rules" ? "Buscar regras" : "Buscar envios" }}
            filters={view === "rules" ? undefined : filterSections}
            activeFilters={view === "rules" ? undefined : activeFilters}
          />
        )}

        {view === "rules" &&
          (visibleRules.length === 0 ? (
            <EmptyState icon={LightningIcon} title={filtering ? "Nenhuma regra encontrada" : "Nenhuma regra ainda"} description={filtering ? "Tente outro nome, mensagem ou pesquisa." : "Crie a primeira: dois dias depois da conclusão do projeto, por e-mail."}>
              {filtering && (
                <Button variant="outline" size="sm" radius="md" onClick={clear}>
                  Limpar busca
                </Button>
              )}
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor(blankRule(data.surveys, rules.length + 1))}>
                Criar regra
              </Button>
            </EmptyState>
          ) : (
            <ul className={styles.grid}>
              {visibleRules.map((rule) => {
                const stats = ruleStats(rule.id);
                const Glyph = channelGlyphs[rule.channel];
                return (
                  <li key={rule.id}>
                    <Card
                      as="article"
                      title={rule.name}
                      icon={
                        <span className={styles.channelSwatch} style={{ "--swatch": channelHues[rule.channel] } as CSSProperties}>
                          <Glyph weight="fill" />
                        </span>
                      }
                      action={<DropdownMenu label={`Ações de ${rule.name}`} triggerLabel={`Abrir ações de ${rule.name}`} sections={ruleMenu(rule)} />}
                    >
                      <CardButton type="button" onClick={() => openEditor(rule)} aria-label={`Editar ${rule.name}`}>
                        <span className={styles.sentence}>
                          {delayLabel(rule.delayHours)} {eventLabels[rule.event].after}, por {rule.channel === "email" ? "e-mail" : "WhatsApp"}.
                        </span>
                        <span className={styles.rules}>
                          <span>Pesquisa {surveyName(rule.surveyId)}</span>
                          <span>{rule.services.length >= 4 ? "Todos os projetos" : rule.services.map((service) => serviceLabels[service].label).join(", ")}</span>
                          <span>{rule.channel === "email" ? `Assunto “${fillSurveyText(rule.message, { name: "Helena", project: "Rebranding" })}”` : "Modelo com botão para a pesquisa"}</span>
                          <span>
                            Silêncio das {rule.quietFrom} às {rule.quietTo}, não repete por {rule.cooldownDays} dias
                          </span>
                        </span>
                        <span className={styles.foot}>
                          <span className={styles.count}>
                            <strong>{formatCount(stats.sent)}</strong>
                            {stats.sent === 1 ? "envio em 30 dias" : "envios em 30 dias"}
                          </span>
                          {stats.sent > 0 && (
                            <Badge tone="success" variant="outline" size="sm">
                              {formatShare(share(stats.answered, stats.sent))} responderam
                            </Badge>
                          )}
                          <Badge tone={rule.active ? "success" : "neutral"} size="sm">
                            {rule.active ? "Ligada" : "Desligada"}
                          </Badge>
                        </span>
                      </CardButton>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ))}

        {(view === "sends" || view === "queue") && (
          <DataTable
            label={view === "queue" ? "Envios agendados" : "Envios"}
            rows={pageRows}
            rowKey={(send) => send.id}
            columns={columns}
            density="compact"
            zebra
            actions={(send) => <DropdownMenu label={`Ações do envio para ${clientsById.get(send.clientId)?.contact.name ?? "o cliente"}`} triggerLabel="Abrir ações do envio" sections={sendMenu(send)} />}
            range={{ page: current, pageSize: PAGE_SIZE, total: rows.length }}
            footer={pages > 1 ? <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} label="Páginas dos envios" /> : undefined}
            empty={
              <EmptyState icon={view === "queue" ? ClockIcon : PaperPlaneTiltIcon} size="sm" title={filtering ? "Nenhum envio neste filtro" : view === "queue" ? "Nada na fila" : "Nenhum envio ainda"} description={filtering ? "Tire um filtro ou mude a busca." : view === "queue" ? "Os próximos projetos concluídos entram aqui quando as regras os pegarem." : "Ligue uma regra ou envie uma pesquisa à mão."}>
                {filtering ? (
                  <Button variant="outline" size="sm" radius="md" onClick={clear}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button size="sm" radius="md" iconStart={<PaperPlaneTiltIcon />} onClick={() => setSending(true)}>
                    Enviar pesquisa
                  </Button>
                )}
              </EmptyState>
            }
          />
        )}

        {view === "metrics" && (
          <div className={styles.metrics}>
            <div className={styles.metricsHead}>
              <Segmented
                as="radio"
                label="Período das métricas"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "30", label: "30 dias" },
                  { value: "90", label: "90 dias" },
                  { value: "365", label: "12 meses" },
                ]}
              />
            </div>
            {metrics.total.sent === 0 ? (
              <EmptyState icon={ChartBarIcon} title="Nenhum envio no período" description="Amplie o período ou ligue uma regra para começar a medir." />
            ) : (
              <>
                <dl className={styles.stats}>
                  {[
                    { label: "Enviados", value: metrics.total.sent, note: "no período" },
                    { label: "Entregues", value: metrics.total.delivered, note: formatShare(share(metrics.total.delivered, metrics.total.sent)) },
                    { label: "Lidos", value: metrics.total.read, note: formatShare(share(metrics.total.read, metrics.total.sent)) },
                    { label: "Respondidos", value: metrics.total.answered, note: formatShare(share(metrics.total.answered, metrics.total.sent)) },
                    { label: "Falhas", value: metrics.total.failed, note: formatShare(share(metrics.total.failed, metrics.total.sent)), tone: metrics.total.failed > 0 ? "danger" : undefined },
                  ].map((stat) => (
                    <div key={stat.label} data-tone={stat.tone}>
                      <dt>{stat.label}</dt>
                      <dd>
                        <strong>{formatCount(stat.value)}</strong>
                        <span>{stat.note}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.metricsGrid}>
                  <Card title="Do envio à resposta" icon={<PaperPlaneTiltIcon />}>
                    <ul className={styles.shareList}>
                      <ShareRow label="Entregues" hue="var(--sys-blue)" value={metrics.total.delivered} base={metrics.total.sent} />
                      <ShareRow label="Lidos" hue="var(--sys-purple)" value={metrics.total.read} base={metrics.total.delivered} extra={`${formatCount(metrics.total.read)} dos entregues`} />
                      <ShareRow label="Respondidos" hue="var(--sys-green)" value={metrics.total.answered} base={metrics.total.read} extra={`${formatCount(metrics.total.answered)} dos lidos`} />
                    </ul>
                  </Card>
                  <Card title="Por canal" icon={<EnvelopeSimpleIcon />}>
                    <ul className={styles.shareList}>
                      {metrics.channels.map((item) => (
                        <ShareRow key={item.channel} icon={channelGlyphs[item.channel]} label={channelLabels[item.channel]} hue={channelHues[item.channel]} value={item.answered} base={item.sent} extra={`${plural(item.answered, "resposta", "respostas")} de ${formatCount(item.sent)}`} />
                      ))}
                    </ul>
                  </Card>
                  <Card title="Tempo até responder" icon={<ClockIcon />} action={<Text as="span" variant="caption1" tone="secondary">{plural(metrics.waitTotal, "resposta", "respostas")}</Text>}>
                    <ul className={styles.shareList}>
                      {metrics.waits.map((bucket) => (
                        <ShareRow key={bucket.label} label={bucket.label} hue="var(--sys-teal)" value={bucket.count} base={metrics.waitTotal} extra={formatCount(bucket.count)} />
                      ))}
                    </ul>
                  </Card>
                  <Card title="Lembrete" icon={<ArrowClockwiseIcon />}>
                    <ul className={styles.shareList}>
                      <ShareRow label="Com lembrete" hue="var(--sys-orange)" value={metrics.reminder.with.answered} base={metrics.reminder.with.sent} />
                      <ShareRow label="Sem lembrete" hue="var(--sys-gray)" value={metrics.reminder.without.answered} base={metrics.reminder.without.sent} />
                    </ul>
                    {Object.keys(metrics.failures).length > 0 && (
                      <div className={styles.failures}>
                        <Text as="h3" variant="caption1" weight="semibold" tone="secondary">
                          Por que não chegou
                        </Text>
                        <ul>
                          {Object.entries(metrics.failures).map(([reason, count]) => (
                            <li key={reason}>
                              <span>{reason}</span>
                              <strong>{formatCount(count)}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                </div>
                <Card title="Por regra" icon={<LightningIcon />}>
                  <ul className={styles.ruleTable}>
                    {metrics.perRule.map((row) => (
                      <li key={row.id}>
                        <span className={styles.ruleTableName}>{row.name}</span>
                        <span>
                          <small>Enviados</small>
                          {formatCount(row.sent)}
                        </span>
                        <span>
                          <small>Lidos</small>
                          {formatShare(share(row.read, row.sent))}
                        </span>
                        <span>
                          <small>Respondidos</small>
                          {formatShare(share(row.answered, row.sent))}
                        </span>
                        <span>
                          <small>Falhas</small>
                          {formatCount(row.failed)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      {editing && <RuleDialog key={editorKey} open rule={editing} surveys={data.surveys} onClose={() => setEditing(null)} onSave={saveRule} />}
      {sending && (
        <SendDialog
          open
          clients={data.clients}
          surveys={data.surveys}
          now={data.now}
          onClose={() => setSending(false)}
          onSent={(send) => {
            setSends((list) => [send, ...list]);
            toast({ title: send.channel === "link" ? "Link gerado" : "Pesquisa na fila de envio", description: `Para ${clientsById.get(send.clientId)?.contact.name ?? "o cliente"}.`, tone: "success", feedback: false });
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Excluir esta regra?"
        description={removing ? `“${removing.name}” para de disparar e os envios na fila dela são cancelados. O histórico fica.` : ""}
        confirmLabel="Excluir"
        pendingLabel="Excluindo"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            setRules((current) => current.filter((rule) => rule.id !== removing.id));
            setSends((list) => list.map((send) => (send.ruleId === removing.id && send.status === "scheduled" ? { ...send, status: "cancelled" } : send)));
            toast({ title: "Regra excluída", description: removing.name, tone: "success", feedback: false });
          }
          setRemoving(null);
        }}
      />
    </div>
  );
}
