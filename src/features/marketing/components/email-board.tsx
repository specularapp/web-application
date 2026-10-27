"use client";

import {
  ArrowCounterClockwiseIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  ChartBarIcon,
  CopyIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  LayoutIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  UsersThreeIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableTitle, type DataTableColumn, type DataTableSort } from "@/components/ui/data-table";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { NameDialog } from "@/components/ui/name-dialog";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { useTabList } from "@/hooks/use-tab-list";
import { slugify } from "@/lib/utils/slug";
import { emailHues, estimateReach, formatCount, formatRate, formatWhen, newBlockId, ratio } from "../email-catalog";
import type { EmailCampaign, EmailData, EmailStatus, EmailTemplate } from "../types";
import { EmailComposer } from "./email-composer";
import { EmailReport } from "./email-report";
import { TemplateGrid, TemplatePreviewDialog } from "./email-templates";
import styles from "./email-board.module.css";

type Tab = EmailStatus | "templates";

const tabs: readonly Tab[] = ["sent", "scheduled", "draft", "templates"];

const tabLabels: Record<Tab, string> = { sent: "Enviados", scheduled: "Agendados", draft: "Rascunhos", templates: "Modelos" };

const PAGE_SIZE = 10;

const SEARCH_LIMIT = 400;

const dateOf = (campaign: EmailCampaign) => campaign.sentAt ?? campaign.scheduledAt ?? campaign.updatedAt;

export type EmailBoardProps = { data: EmailData };

// A prancha do e-mail marketing: as abas de situação (enviados, agendados, rascunhos e modelos), a barra de
// busca e filtros da casa, o resumo dos envios e a tabela com a conversão de cada e-mail (entregues, abertos,
// cliques e clique por abertura). Enviado abre o relatório; rascunho e agendado abrem o editor, que toma a
// tela. Criar parte de um modelo pronto ou do zero. Tudo vive no estado desta tela até o domínio ir para o
// banco: nada é gravado nem enviado.
export function EmailBoard({ data }: EmailBoardProps) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState(data.campaigns);
  const [templates, setTemplates] = useState(data.templates);
  const [tab, setTab] = useState<Tab>("sent");
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<string[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [composing, setComposing] = useState<EmailCampaign | null>(null);
  const [report, setReport] = useState<EmailCampaign | null>(null);
  const [picking, setPicking] = useState(false);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);
  const [removing, setRemoving] = useState<EmailCampaign[] | null>(null);
  const [templating, setTemplating] = useState<EmailCampaign | null>(null);
  const reportReady = useOpenedOnce(report !== null);
  const tabList = useTabList(tabs, tab, (next) => changeTab(next));

  const listName = (id: string) => data.lists.find((list) => list.id === id)?.name ?? "Lista removida";
  const owners = useMemo(() => [...new Set(campaigns.map((campaign) => campaign.createdBy))].toSorted(), [campaigns]);
  const counts: Record<Tab, number> = {
    sent: campaigns.filter((campaign) => campaign.status === "sent").length,
    scheduled: campaigns.filter((campaign) => campaign.status === "scheduled").length,
    draft: campaigns.filter((campaign) => campaign.status === "draft").length,
    templates: templates.length,
  };

  const term = slugify(search, SEARCH_LIMIT);
  const filtering = Boolean(term) || audience.length > 0 || owner !== null;

  const visible = useMemo(() => {
    const matching = campaigns.filter(
      (campaign) =>
        campaign.status === tab &&
        (!term || slugify(`${campaign.name} ${campaign.subject}`, SEARCH_LIMIT).includes(term)) &&
        (audience.length === 0 || campaign.audience.some((id) => audience.includes(id))) &&
        (!owner || campaign.createdBy === owner),
    );
    const values: Record<string, (campaign: EmailCampaign) => number | string> = {
      name: (campaign) => campaign.name,
      date: (campaign) => dateOf(campaign),
      opens: (campaign) => (campaign.stats ? ratio(campaign.stats.opens, campaign.stats.delivered) : -1),
      clicks: (campaign) => (campaign.stats ? ratio(campaign.stats.clicks, campaign.stats.delivered) : -1),
      ctor: (campaign) => (campaign.stats ? ratio(campaign.stats.clicks, campaign.stats.opens) : -1),
      reach: (campaign) => estimateReach(data.lists, campaign.audience),
    };
    const by = values[sort?.column ?? "date"] ?? values.date;
    const direction = sort ? (sort.direction === "asc" ? 1 : -1) : tab === "scheduled" ? 1 : -1;
    return matching.toSorted((a, b) => {
      const left = by(a);
      const right = by(b);
      return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "pt-BR")) * direction;
    });
  }, [campaigns, tab, term, audience, owner, sort, data.lists]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleTemplates = templates.filter((template) => !term || slugify(`${template.name} ${template.description}`, SEARCH_LIMIT).includes(term));
  const sentStats = campaigns.flatMap((campaign) => (campaign.status === "sent" && campaign.stats ? [campaign.stats] : []));

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSelected([]);
    setSort(null);
  }

  const clearAll = () => {
    setSearch("");
    setAudience([]);
    setOwner(null);
    setPage(1);
  };

  const now = () => new Date().toISOString();

  const upsert = (campaign: EmailCampaign) => setCampaigns((current) => (current.some((item) => item.id === campaign.id) ? current.map((item) => (item.id === campaign.id ? campaign : item)) : [campaign, ...current]));

  const fromTemplate = (template: EmailTemplate | null): EmailCampaign => ({
    id: `em-${newBlockId()}`,
    name: template ? template.name : "Novo e-mail",
    subject: template?.subject ?? "",
    preheader: template?.preheader ?? "",
    fromName: data.sender.name,
    fromEmail: data.sender.email,
    audience: [],
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    updatedAt: now(),
    createdBy: data.author,
    templateId: template?.id ?? null,
    hue: template?.hue ?? "blue",
    blocks: (template?.blocks ?? []).map((block) => ({ ...block, id: newBlockId() })),
    stats: null,
  });

  const compose = (template: EmailTemplate | null) => {
    setPicking(false);
    setPreviewing(null);
    setComposing(fromTemplate(template));
  };

  const open = (campaign: EmailCampaign) => (campaign.status === "sent" ? setReport(campaign) : setComposing(campaign));

  const duplicate = (targets: EmailCampaign[]) => {
    const copies = targets.map((campaign) => ({ ...campaign, id: `em-${newBlockId()}`, name: `${campaign.name} (cópia)`, status: "draft" as const, sentAt: null, scheduledAt: null, stats: null, updatedAt: now(), createdBy: data.author }));
    setCampaigns((current) => [...copies, ...current]);
    setSelected([]);
    toast({ title: copies.length === 1 ? "E-mail duplicado" : `${copies.length} e-mails duplicados`, description: "A cópia está em Rascunhos, pronta para editar.", tone: "success", feedback: false });
    return copies;
  };

  const cancelSchedule = (targets: EmailCampaign[]) => {
    const ids = new Set(targets.map((campaign) => campaign.id));
    setCampaigns((current) => current.map((campaign) => (ids.has(campaign.id) ? { ...campaign, status: "draft", scheduledAt: null, updatedAt: now() } : campaign)));
    setSelected([]);
    toast({ title: targets.length === 1 ? "Agendamento cancelado" : `${targets.length} agendamentos cancelados`, description: "Voltaram para Rascunhos e não saem mais sozinhos.", tone: "neutral" });
  };

  const remove = () => {
    if (!removing) return;
    const ids = new Set(removing.map((campaign) => campaign.id));
    setCampaigns((current) => current.filter((campaign) => !ids.has(campaign.id)));
    setSelected([]);
    toast({ title: removing.length === 1 ? "E-mail excluído" : `${removing.length} e-mails excluídos`, description: "Saíram da lista.", tone: "neutral" });
    setRemoving(null);
  };

  const menu = (campaign: EmailCampaign): DropdownSection[] => [
    {
      id: "abrir",
      items: [
        campaign.status === "sent" ? { id: "relatorio", label: "Ver relatório", icon: ChartBarIcon, onSelect: () => setReport(campaign) } : { id: "editar", label: "Editar", icon: PencilSimpleIcon, onSelect: () => setComposing(campaign) },
        { id: "duplicar", label: "Duplicar", icon: CopyIcon, onSelect: () => void duplicate([campaign]) },
        { id: "modelo", label: "Salvar como modelo", icon: LayoutIcon, onSelect: () => setTemplating(campaign) },
        ...(campaign.status === "scheduled" ? [{ id: "cancelar", label: "Cancelar agendamento", icon: XCircleIcon, onSelect: () => cancelSchedule([campaign]) }] : []),
      ],
    },
    ...(campaign.status !== "sent" ? [{ id: "perigo", items: [{ id: "excluir", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving([campaign]) }] }] : []),
  ];

  const name: DataTableColumn<EmailCampaign> = {
    id: "name",
    header: "Nome do e-mail",
    width: "16rem",
    sortable: true,
    cell: (campaign) => (
      <DataTableTitle
        title={campaign.name}
        caption={campaign.subject.replace(/\{\{primeiro_nome\}\}/g, "Nome")}
        media={<span className={styles.hue} style={{ "--hue": emailHues[campaign.hue].value } as CSSProperties} aria-hidden="true" />}
        onClick={() => open(campaign)}
      />
    ),
  };

  const audienceColumn: DataTableColumn<EmailCampaign> = {
    id: "audience",
    header: "Público",
    hideBelow: "md",
    cell: (campaign) =>
      campaign.audience.length === 0 ? (
        <Badge size="sm" tone="warning">
          Sem público
        </Badge>
      ) : (
        <span className={styles.audience}>
          <Badge size="sm">{listName(campaign.audience[0])}</Badge>
          {campaign.audience.length > 1 && (
            <Badge size="sm" variant="outline" title={campaign.audience.slice(1).map(listName).join(", ")}>
              +{campaign.audience.length - 1}
            </Badge>
          )}
        </span>
      ),
  };

  const ownerColumn: DataTableColumn<EmailCampaign> = {
    id: "owner",
    header: "Responsável",
    hideBelow: "lg",
    cell: (campaign) => (
      <span className={styles.person}>
        <Avatar name={campaign.createdBy} size="xs" aria-hidden="true" />
        <Text as="span" variant="footnote" truncate>
          {campaign.createdBy.split(" ")[0]}
        </Text>
      </span>
    ),
  };

  const conversion = (campaign: EmailCampaign, part: "opens" | "clicks", whole: "delivered" | "opens") =>
    campaign.stats ? (
      <span className={styles.conversion}>
        <strong>{formatRate(campaign.stats[part], campaign.stats[whole])}</strong>
        <small>
          {formatCount(campaign.stats[part])} de {formatCount(campaign.stats[whole])}
        </small>
      </span>
    ) : (
      <Badge size="sm">Sem dados</Badge>
    );

  const reachColumn: DataTableColumn<EmailCampaign> = { id: "reach", header: "Alcance estimado", align: "end", sortable: true, cell: (campaign) => <span className={styles.number}>{formatCount(estimateReach(data.lists, campaign.audience))}</span> };

  const columns: DataTableColumn<EmailCampaign>[] =
    tab === "sent"
      ? [
          name,
          audienceColumn,
          {
            id: "delivery",
            header: "Disparos",
            hideBelow: "md",
            cell: (campaign) => {
              if (!campaign.stats) return <Badge size="sm">Sem dados</Badge>;
              const share = ratio(campaign.stats.delivered, campaign.stats.recipients);
              return (
                <span className={styles.delivery} data-level={share >= 97 ? "alto" : share >= 90 ? "medio" : "baixo"} title={`${formatRate(campaign.stats.delivered, campaign.stats.recipients)} entregues`}>
                  <span className={styles.deliveryBar} aria-hidden="true">
                    <i style={{ width: `${share}%` }} />
                  </span>
                  <span className={styles.number}>
                    {formatCount(campaign.stats.delivered)}/{formatCount(campaign.stats.recipients)}
                  </span>
                </span>
              );
            },
          },
          { id: "opens", header: "Abertos", align: "end", sortable: true, cell: (campaign) => conversion(campaign, "opens", "delivered") },
          { id: "clicks", header: "Cliques", align: "end", sortable: true, cell: (campaign) => conversion(campaign, "clicks", "delivered") },
          { id: "ctor", header: "Clique por abertura", align: "end", sortable: true, hideBelow: "lg", cell: (campaign) => conversion(campaign, "clicks", "opens") },
          ownerColumn,
          { id: "date", header: "Enviado em", sortable: true, hideBelow: "md", cell: (campaign) => <span className={styles.muted}>{campaign.sentAt ? formatWhen(campaign.sentAt) : "Agora"}</span> },
        ]
      : [
          name,
          audienceColumn,
          reachColumn,
          ownerColumn,
          {
            id: "date",
            header: tab === "scheduled" ? "Sai em" : "Última edição",
            sortable: true,
            hideBelow: "md",
            cell: (campaign) =>
              tab === "scheduled" && campaign.scheduledAt ? (
                <Badge size="sm" tone="info" icon={<CalendarDotsIcon />}>
                  {formatWhen(campaign.scheduledAt)}
                </Badge>
              ) : (
                <span className={styles.muted}>{formatWhen(campaign.updatedAt)}</span>
              ),
          },
        ];

  const selectedCampaigns = rows.filter((campaign) => selected.includes(campaign.id));
  const selectedScheduled = selectedCampaigns.filter((campaign) => campaign.status === "scheduled");
  const selectedDeletable = selectedCampaigns.filter((campaign) => campaign.status !== "sent");

  const filterSections: DropdownSection[] = [
    {
      id: "publico",
      label: "Público",
      items: data.lists.map((list) => ({
        kind: "toggle" as const,
        id: `publico-${list.id}`,
        label: list.name,
        checked: audience.includes(list.id),
        onChange: (checked: boolean) => {
          setAudience((current) => (checked ? [...current, list.id] : current.filter((item) => item !== list.id)));
          setPage(1);
        },
      })),
    },
    {
      id: "responsavel",
      label: "Responsável",
      items: owners.map((person) => ({
        id: `responsavel-${person}`,
        label: person,
        media: <Avatar name={person} size="xs" aria-hidden="true" />,
        selected: owner === person,
        keepOpen: true,
        onSelect: () => {
          setOwner((current) => (current === person ? null : person));
          setPage(1);
        },
      })),
    },
    ...(audience.length > 0 || owner ? [{ id: "limpar", items: [{ id: "limpar", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: clearAll }] }] : []),
  ];

  const activeFilters = [
    ...audience.map((id) => ({ id: `publico-${id}`, label: listName(id), icon: UsersThreeIcon, onClear: () => setAudience((current) => current.filter((item) => item !== id)) })),
    ...(owner ? [{ id: "responsavel", label: owner, icon: UserIcon, onClear: () => setOwner(null) }] : []),
  ];

  if (composing)
    return (
      <EmailComposer
        key={composing.id}
        campaign={composing}
        lists={data.lists}
        onBack={() => setComposing(null)}
        onSave={(campaign) => {
          upsert({ ...campaign, updatedAt: now() });
          toast({ title: "Rascunho salvo", description: `${campaign.name} está em Rascunhos.`, tone: "success", feedback: false });
        }}
        onSchedule={(campaign, at) => {
          upsert({ ...campaign, status: "scheduled", scheduledAt: at, updatedAt: now() });
          setComposing(null);
          changeTab("scheduled");
          toast({ title: "Envio agendado", description: `${campaign.name} sai em ${formatWhen(at)}.`, tone: "success" });
        }}
        onSend={(campaign) => {
          const recipients = estimateReach(data.lists, campaign.audience);
          const links = campaign.blocks.flatMap((block) => (block.kind === "button" ? [{ label: block.label, url: block.href, clicks: 0 }] : []));
          upsert({ ...campaign, status: "sent", sentAt: now(), scheduledAt: null, updatedAt: now(), stats: { recipients, delivered: recipients, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0, spam: 0, links, hourly: [] } });
          setComposing(null);
          changeTab("sent");
          toast({ title: "E-mail na fila de envio", description: "Aberturas e cliques aparecem no relatório conforme chegam.", tone: "success" });
        }}
      />
    );

  const createButton = (
    <>
      <span className={styles.wide}>
        <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setPicking(true)}>
          Criar e-mail
        </Button>
      </span>
      <span className={styles.narrow}>
        <IconButton label="Criar e-mail" size="sm" radius="md" onClick={() => setPicking(true)}>
          <PlusIcon />
        </IconButton>
      </span>
    </>
  );

  const bulk =
    selectedCampaigns.length > 0 ? (
      <DropdownMenu
        label="Ações da seleção"
        triggerLabel={`Opções para ${selectedCampaigns.length} ${selectedCampaigns.length === 1 ? "e-mail selecionado" : "e-mails selecionados"}`}
        searchable={false}
        trigger={{ variant: "outline", radius: "md" }}
        triggerContent={
          <span className={styles.bulk}>
            Opções
            <Badge size="sm" tone="accent">
              {selectedCampaigns.length}
            </Badge>
            <CaretDownIcon aria-hidden="true" />
          </span>
        }
        sections={[
          {
            id: "lote",
            label: `${selectedCampaigns.length} ${selectedCampaigns.length === 1 ? "selecionado" : "selecionados"}`,
            items: [
              { id: "duplicar", label: "Duplicar", icon: CopyIcon, onSelect: () => void duplicate(selectedCampaigns) },
              ...(selectedScheduled.length > 0 ? [{ id: "cancelar", label: `Cancelar agendamento (${selectedScheduled.length})`, icon: XCircleIcon, onSelect: () => cancelSchedule(selectedScheduled) }] : []),
              { id: "limpar", label: "Limpar seleção", icon: XIcon, onSelect: () => setSelected([]) },
            ],
          },
          ...(selectedDeletable.length > 0 ? [{ id: "perigo", items: [{ id: "excluir", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving(selectedDeletable) }] }] : []),
        ]}
      />
    ) : undefined;

  const emptyTitle = filtering ? "Nada encontrado" : tab === "sent" ? "Nenhum e-mail enviado ainda" : tab === "scheduled" ? "Nada agendado" : "Nenhum rascunho";
  const emptyDescription = filtering ? "Nenhum e-mail bate com a busca e os filtros. Tente outra palavra ou limpe tudo." : "Comece por um modelo pronto: o texto, as cores e os blocos ficam todos editáveis.";

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: (value) => {
            setSearch(value);
            setPage(1);
          }, placeholder: tab === "templates" ? "Buscar modelo" : "Buscar por nome ou assunto", label: "Buscar e-mail" }}
        filters={tab === "templates" ? undefined : filterSections}
        activeFilters={tab === "templates" ? [] : activeFilters}
        selection={bulk}
        action={createButton}
      />

      <div className={styles.head}>
        <div className={styles.tabs} aria-label="Situação dos e-mails" {...tabList.listProps}>
          {tabs.map((value) => (
            <button key={value} type="button" className={styles.tab} {...tabList.tabProps(value)} onClick={() => changeTab(value)}>
              {tabLabels[value]}
              <span className={styles.tabCount}>{counts[value]}</span>
            </button>
          ))}
        </div>
        {tab === "sent" && sentStats.length > 0 && <Summary stats={sentStats} />}
      </div>

      <div className={styles.content}>
        {tab === "templates" ? (
          visibleTemplates.length === 0 ? (
            <EmptyState icon={LayoutIcon} title="Nenhum modelo encontrado" description="Tente outra palavra, ou guarde um e-mail como modelo pelo menu dele.">
              <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
                Limpar busca
              </Button>
            </EmptyState>
          ) : (
            <TemplateGrid templates={visibleTemplates} sender={data.sender} onPick={setPreviewing} pickLabel={(template) => `Ver a prévia de ${template.name}`} />
          )
        ) : (
          <DataTable
            label={`E-mails ${tabLabels[tab].toLowerCase()}`}
            columns={columns}
            rows={rows}
            rowKey={(campaign) => campaign.id}
            fill
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            selection={{ selected, onChange: setSelected, rowLabel: (campaign) => `Selecionar ${campaign.name}` }}
            onRowClick={open}
            actions={(campaign) => <DropdownMenu label={`Ações de ${campaign.name}`} triggerLabel={`Mais ações de ${campaign.name}`} icon={<DotsThreeIcon />} size="sm" searchable={false} sections={menu(campaign)} />}
            range={{ page: currentPage, pageSize: PAGE_SIZE, total: visible.length }}
            footer={pageCount > 1 ? <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} label="Páginas de e-mails" /> : undefined}
            empty={
              <EmptyState icon={EnvelopeSimpleIcon} title={emptyTitle} description={emptyDescription} size="sm">
                {filtering && (
                  <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
                    Limpar busca
                  </Button>
                )}
                <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setPicking(true)}>
                  Criar e-mail
                </Button>
              </EmptyState>
            }
          />
        )}
      </div>

      <Dialog open={picking} onClose={() => setPicking(false)} label="Criar e-mail" size="lg" surface="solid">
        <div className={styles.picker}>
          <DialogHeader title="Criar e-mail" description="Escolha um modelo pronto ou comece em branco" onClose={() => setPicking(false)} />
          <div className={styles.pickerBody}>
            <TemplateGrid templates={templates} sender={data.sender} onPick={compose} onBlank={() => compose(null)} pickLabel={(template) => `Criar a partir de ${template.name}`} />
          </div>
        </div>
      </Dialog>

      <TemplatePreviewDialog template={previewing} sender={data.sender} onClose={() => setPreviewing(null)} onUse={compose} />

      {reportReady && (
        <EmailReport
          campaign={report}
          lists={data.lists}
          onClose={() => setReport(null)}
          onDuplicate={(campaign) => {
            const [copy] = duplicate([campaign]);
            setReport(null);
            setComposing(copy);
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title={removing && removing.length > 1 ? `Excluir ${removing.length} e-mails?` : "Excluir este e-mail?"}
        description={removing && removing.length === 1 ? `“${removing[0].name}” sai da lista${removing[0].status === "scheduled" ? " e não será mais enviado" : ""}.` : "Saem da lista, e os agendados não serão mais enviados."}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
      />

      {templating && (
        <NameDialog
          open
          title="Salvar como modelo"
          description="O desenho fica na aba Modelos para criar outros e-mails a partir dele."
          placeholder="Follow-up de proposta, Newsletter"
          initialValue={templating.name}
          maxLength={80}
          confirmLabel="Salvar modelo"
          onClose={() => setTemplating(null)}
          onSubmit={async (value) => {
            const saved: EmailTemplate = { id: `tpl-${newBlockId()}`, name: value, description: `Salvo a partir de ${templating.name}`, category: "simples", hue: templating.hue, subject: templating.subject, preheader: templating.preheader, blocks: templating.blocks, custom: true };
            setTemplates((current) => [saved, ...current]);
            toast({ title: "Modelo salvo", description: `${value} está na aba Modelos.`, tone: "success", feedback: false });
            setTemplating(null);
            return undefined;
          }}
        />
      )}
    </div>
  );
}

// O resumo dos envios: quantos saíram e as taxas somadas de todos, para comparar cada linha com a média.
function Summary({ stats }: { stats: NonNullable<EmailCampaign["stats"]>[] }) {
  const total = stats.reduce(
    (sum, item) => ({ recipients: sum.recipients + item.recipients, delivered: sum.delivered + item.delivered, opens: sum.opens + item.opens, clicks: sum.clicks + item.clicks, unsubscribes: sum.unsubscribes + item.unsubscribes }),
    { recipients: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0 },
  );
  const tiles = [
    { id: "enviados", label: "E-mails enviados", value: formatCount(total.recipients), caption: `${stats.length} ${stats.length === 1 ? "disparo" : "disparos"}` },
    { id: "abertura", label: "Abertura média", value: formatRate(total.opens, total.delivered), caption: `${formatCount(total.opens)} aberturas únicas` },
    { id: "clique", label: "Clique médio", value: formatRate(total.clicks, total.delivered), caption: `${formatCount(total.clicks)} cliques únicos` },
    { id: "descadastro", label: "Descadastros", value: formatCount(total.unsubscribes), caption: `${formatRate(total.unsubscribes, total.delivered)} dos entregues` },
  ];

  return (
    <ul className={styles.summary} aria-label="Resumo dos envios">
      {tiles.map((tile) => (
        <li key={tile.id} className={styles.tile}>
          <span className={styles.tileLabel}>{tile.label}</span>
          <strong className={styles.tileValue}>{tile.value}</strong>
          <small className={styles.tileCaption}>{tile.caption}</small>
        </li>
      ))}
    </ul>
  );
}
