"use client";

import styled from "@emotion/styled";
import { CalendarCheckIcon, CaretUpDownIcon, ChatsCircleIcon, FunnelSimpleIcon, IdentificationCardIcon, KanbanIcon, LifebuoyIcon, ListBulletsIcon, SquaresFourIcon, UserIcon, XIcon } from "@phosphor-icons/react";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar, type PageToolbarFilter } from "@/components/layout/page-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { slugify } from "@/lib/utils/slug";
import { DAY, dateTimeLabel, formatShare, serviceLabels, services, timeAgo, treatmentIsOpen, treatmentLabels, treatmentOrder } from "../labels";
import { setTreatmentStatus, slaOf } from "../treatments";
import type { NpsData, NpsService, Treatment, TreatmentStatus } from "../types";
import { ScoreBubble } from "./parts";
import { ResolveDialog, ResponseProfile, ResponseThread } from "./response-thread";
import { Segmented } from "./segmented";
import styles from "./treatments.module.css";

type View = "board" | "list";
type ClosedPeriod = "30" | "90" | "all";

const SIDE_QUERY = "(min-width: 64rem)";

const CardMain = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  padding: 0;
  font-family: var(--font-body);
  color: var(--color-label);
  text-align: start;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

/**
 * As tratativas dos detratores em quadro, uma coluna por situação, ou em lista. O cartão mostra quem, a nota
 * e o prazo do primeiro contato, com quem cuida e o "Mover para" na ponta. Abrir leva ao atendimento, o
 * mesmo das respostas, com a ficha ao lado. Resolver pergunta se o cliente saiu recuperado.
 */
export function TreatmentsBoard({ data }: { data: NpsData }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const side = useMediaQuery(SIDE_QUERY);
  const [treatments, setTreatments] = useState(data.treatments);
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [service, setService] = useState<NpsService | "all">("all");
  const [closedPeriod, setClosedPeriod] = useState<ClosedPeriod>("30");
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState<"thread" | "profile">("thread");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const responsesById = useMemo(() => new Map(data.responses.map((response) => [response.id, response])), [data.responses]);
  const clientsById = useMemo(() => new Map(data.clients.map((client) => [client.id, client])), [data.clients]);
  const surveysById = useMemo(() => new Map(data.surveys.map((survey) => [survey.id, survey])), [data.surveys]);
  const teamById = useMemo(() => new Map(data.team.map((member) => [member.id, member])), [data.team]);
  const now = Date.parse(data.now);

  const visible = useMemo(() => {
    const term = slugify(search.trim(), 80);
    return treatments.filter((treatment) => {
      const response = responsesById.get(treatment.responseId);
      const client = response ? clientsById.get(response.clientId) : undefined;
      if (!treatmentIsOpen(treatment.status) && closedPeriod !== "all" && treatment.closedAt && now - Date.parse(treatment.closedAt) > Number(closedPeriod) * DAY) return false;
      if (owners.length > 0 && !owners.includes(treatment.ownerId ?? "")) return false;
      if (service !== "all" && client?.project.service !== service) return false;
      if (term && !slugify(`${client?.contact.name} ${client?.contact.company} ${client?.project.name} ${response?.comment}`, 600).includes(term)) return false;
      return true;
    });
  }, [treatments, responsesById, clientsById, search, owners, service, closedPeriod, now]);

  const save = (treatment: Treatment) => setTreatments((list) => list.map((item) => (item.id === treatment.id ? treatment : item)));
  const move = (treatment: Treatment, status: TreatmentStatus) => {
    if (status === treatment.status) return;
    if (status === "resolved") return setResolvingId(treatment.id);
    save(setTreatmentStatus(treatment, status, new Date().toISOString()));
  };
  const resolving = treatments.find((treatment) => treatment.id === resolvingId) ?? null;
  const resolvingName = resolving ? (clientsById.get(responsesById.get(resolving.responseId)?.clientId ?? "")?.contact.name ?? "Cliente") : "Cliente";

  const moveMenu = (treatment: Treatment, name: string) => (
    <DropdownMenu
      label="Mover para"
      triggerLabel={`Mudar a situação de ${name}`}
      icon={<CaretUpDownIcon />}
      searchable={false}
      sections={[
        {
          id: "status",
          label: "Mover para",
          items: treatmentOrder.map((status) => ({ id: status, label: treatmentLabels[status].label, selected: status === treatment.status, media: <span className={styles.dot} style={{ "--tone": treatmentLabels[status].color } as CSSProperties} />, onSelect: () => move(treatment, status) })),
        },
      ]}
    />
  );

  const filterSections: DropdownSection[] = [
    ...(owners.length > 0 || service !== "all" || closedPeriod !== "30" ? [{ id: "clear", items: [{ id: "clear", label: "Limpar filtros", icon: XIcon, onSelect: () => { setOwners([]); setService("all"); setClosedPeriod("30"); } }] }] : []),
    {
      id: "owner",
      label: "Responsável",
      items: [...data.team.map((member) => ({ id: member.id, name: member.name })), { id: "", name: "Sem responsável" }].map((member) => ({
        kind: "toggle" as const,
        id: `owner-${member.id || "none"}`,
        label: member.name,
        media: member.id ? <Avatar name={member.name} seed={member.id} size="xs" /> : <UserIcon aria-hidden="true" />,
        checked: owners.includes(member.id),
        onChange: (on: boolean) => setOwners((list) => (on ? [...list, member.id] : list.filter((item) => item !== member.id))),
      })),
    },
    { id: "service", label: "Serviço", items: [{ value: "all" as const, label: "Todos os serviços" }, ...services.map((value) => ({ value, label: serviceLabels[value].label }))].map((option) => ({ id: `service-${option.value}`, label: option.label, icon: SquaresFourIcon, selected: service === option.value, keepOpen: true, onSelect: () => setService(option.value) })) },
    {
      id: "closed",
      label: "Encerradas",
      items: ([["30", "Nos últimos 30 dias"], ["90", "Nos últimos 90 dias"], ["all", "Todas"]] as const).map(([value, label]) => ({ id: `closed-${value}`, label, icon: CalendarCheckIcon, selected: closedPeriod === value, keepOpen: true, onSelect: () => setClosedPeriod(value) })),
    },
  ];

  const activeFilters: PageToolbarFilter[] = [
    ...owners.map((id) => ({ id: `owner-${id || "none"}`, label: teamById.get(id)?.name ?? "Sem responsável", icon: UserIcon, onClear: () => setOwners((list) => list.filter((item) => item !== id)) })),
    ...(service === "all" ? [] : [{ id: "service", label: serviceLabels[service].label, icon: SquaresFourIcon, onClear: () => setService("all") }]),
    ...(closedPeriod === "30" ? [] : [{ id: "closed", label: closedPeriod === "90" ? "Encerradas em 90 dias" : "Todas as encerradas", icon: FunnelSimpleIcon, onClear: () => setClosedPeriod("30") }]),
  ];
  const filtering = activeFilters.length > 0 || Boolean(search.trim());
  const clear = () => {
    setSearch("");
    setOwners([]);
    setService("all");
    setClosedPeriod("30");
  };

  const identity = (treatment: Treatment) => {
    const response = responsesById.get(treatment.responseId);
    const client = response ? clientsById.get(response.clientId) : undefined;
    return { response, client, name: client?.contact.name ?? "Cliente" };
  };

  const columns: DataTableColumn<Treatment>[] = [
    {
      id: "client",
      header: "Cliente",
      sortable: true,
      sortValue: (treatment) => identity(treatment).name,
      cell: (treatment) => {
        const { client, name } = identity(treatment);
        return <DataTableTitle title={name} caption={client?.project.name} media={<Avatar name={name} seed={client?.id ?? treatment.id} size="xs" />} onClick={() => setOpenedId(treatment.id)} />;
      },
    },
    { id: "score", header: "Nota", sortable: true, sortValue: (treatment) => identity(treatment).response?.score ?? 0, cell: (treatment) => <ScoreBubble score={identity(treatment).response?.score ?? 0} size="sm" /> },
    { id: "status", header: "Situação", sortable: true, sortValue: (treatment) => treatmentOrder.indexOf(treatment.status), cell: (treatment) => <Badge tone={treatmentLabels[treatment.status].tone} size="sm">{treatmentLabels[treatment.status].label}</Badge> },
    {
      id: "owner",
      header: "Responsável",
      hideBelow: "md",
      cell: (treatment) => {
        const owner = treatment.ownerId ? teamById.get(treatment.ownerId) : null;
        return owner ? (
          <span className={styles.owner}>
            <Avatar name={owner.name} seed={owner.id} size="xs" />
            {owner.name}
          </span>
        ) : (
          <Text as="span" variant="footnote" tone="tertiary">Sem responsável</Text>
        );
      },
    },
    {
      id: "sla",
      header: "Primeiro contato",
      sortable: true,
      sortValue: (treatment) => treatment.dueAt,
      cell: (treatment) => {
        const sla = slaOf(treatment, data.now);
        return <span className={styles.sla} data-tone={sla.tone}>{sla.label}</span>;
      },
    },
    { id: "created", header: "Aberta em", hideBelow: "lg", sortable: true, sortValue: (treatment) => treatment.createdAt, cell: (treatment) => <Text as="span" variant="footnote" tone="secondary">{dateTimeLabel(treatment.createdAt)}</Text> },
  ];

  const opened = treatments.find((treatment) => treatment.id === openedId) ?? null;
  const openedIdentity = opened ? identity(opened) : null;
  const openedResponse = openedIdentity?.response;
  const history = openedResponse ? data.responses.filter((response) => response.clientId === openedResponse.clientId) : [];
  const close = () => {
    setOpenedId(null);
    setDialogTab("thread");
  };

  const empty = (
    <EmptyState icon={LifebuoyIcon} title={filtering ? "Nenhuma tratativa aqui" : "Nenhuma tratativa aberta"} description={filtering ? "Ninguém combina com a busca ou os filtros." : "Ótimo sinal: nenhum detrator esperando contato."}>
      {filtering ? (
        <Button variant="outline" size="sm" radius="md" onClick={clear}>
          Limpar busca e filtros
        </Button>
      ) : (
        <Button size="sm" radius="md" href="/nps/respostas">
          Ver respostas
        </Button>
      )}
    </EmptyState>
  );

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Buscar cliente, projeto ou comentário", label: "Buscar tratativa" }}
        filters={filterSections}
        activeFilters={activeFilters}
        view={{
          value: view,
          onChange: (next) => setView(next === "list" ? "list" : "board"),
          label: "Jeito de ver as tratativas",
          options: [
            { value: "board", label: "Quadro", icon: <KanbanIcon /> },
            { value: "list", label: "Lista", icon: <ListBulletsIcon /> },
          ],
        }}
      />

      {visible.length === 0 ? (
        empty
      ) : view === "list" && !mobile ? (
        <div className={styles.list}>
          <DataTable label="Tratativas" rows={visible.toSorted((a, b) => a.dueAt.localeCompare(b.dueAt))} rowKey={(treatment) => treatment.id} columns={columns} onRowClick={(treatment) => setOpenedId(treatment.id)} actions={(treatment) => moveMenu(treatment, identity(treatment).name)} />
        </div>
      ) : (
        <ol className={styles.columns} aria-label="Quadro de tratativas">
          {treatmentOrder.map((status) => {
            const items = visible.filter((treatment) => treatment.status === status).toSorted((a, b) => a.dueAt.localeCompare(b.dueAt));
            const late = items.filter((treatment) => !treatment.firstContactAt && Date.parse(treatment.dueAt) < now).length;
            const withOutcome = items.filter((treatment) => treatment.recovered !== null);
            const recovered = withOutcome.filter((treatment) => treatment.recovered).length;
            return (
              <li key={status} className={styles.column} aria-label={`${treatmentLabels[status].label}, ${items.length}`} style={{ "--tone": treatmentLabels[status].color } as CSSProperties}>
                <header className={styles.columnHead}>
                  <span className={styles.stagePill}>
                    <span className={styles.dot} aria-hidden="true" />
                    {treatmentLabels[status].label}
                    <b>{items.length}</b>
                  </span>
                  {status === "open" && late > 0 && (
                    <Badge tone="danger" size="sm">
                      {late} {late === 1 ? "atrasada" : "atrasadas"}
                    </Badge>
                  )}
                  {status === "resolved" && withOutcome.length > 0 && (
                    <Badge tone="success" size="sm">
                      {formatShare((recovered / withOutcome.length) * 100)} recuperados
                    </Badge>
                  )}
                </header>
                <Text variant="caption1" tone="tertiary" className={styles.columnHint}>
                  {treatmentLabels[status].description}
                </Text>
                <ul className={styles.cards}>
                  {items.length === 0 && <li className={styles.columnEmpty}>Nada nesta etapa.</li>}
                  {items.map((treatment) => {
                    const { response, client, name } = identity(treatment);
                    const sla = slaOf(treatment, data.now);
                    const owner = treatment.ownerId ? teamById.get(treatment.ownerId) : null;
                    return (
                      <li key={treatment.id} className={styles.card}>
                        <CardMain type="button" onClick={() => setOpenedId(treatment.id)} aria-label={`Abrir o atendimento de ${name}, nota ${response?.score ?? 0}, ${sla.label}`}>
                          <Avatar name={name} seed={client?.id ?? treatment.id} size="sm" />
                          <span className={styles.cardText}>
                            <strong>{name}</strong>
                            <span className={styles.cardLine}>
                              <ScoreBubble score={response?.score ?? 0} size="sm" />
                              <span className={styles.sla} data-tone={sla.tone}>
                                {sla.label}
                              </span>
                            </span>
                          </span>
                        </CardMain>
                        {response?.comment && <p className={styles.cardComment}>{response.comment}</p>}
                        <span className={styles.cardFoot}>
                          <span className={styles.owner} title={owner ? `Com ${owner.name}` : "Sem responsável"}>
                            {owner ? <Avatar name={owner.name} seed={owner.id} size="xs" /> : <UserIcon aria-hidden="true" />}
                            <span>{owner ? owner.name.split(" ")[0] : "Sem responsável"}</span>
                          </span>
                          <time dateTime={treatment.createdAt} className={styles.age}>
                            {timeAgo(treatment.createdAt, data.now)}
                          </time>
                          {moveMenu(treatment, name)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

      {opened && openedResponse && (
        <Dialog open onClose={close} label={`Atendimento de ${openedIdentity?.name ?? "cliente"}`} size="xl" surface="solid">
          <div className={styles.workspace} data-side={side || undefined}>
            {(side || dialogTab === "thread") && (
              <ResponseThread
                response={openedResponse}
                client={openedIdentity?.client}
                survey={surveysById.get(openedResponse.surveyId)}
                treatment={opened}
                team={data.team}
                now={data.now}
                onTreatment={save}
                trailing={
                  <span className={styles.dialogTools}>
                    {!side && (
                      <IconButton label="Ver a ficha da resposta" variant="ghost" size="sm" onClick={() => setDialogTab("profile")}>
                        <IdentificationCardIcon />
                      </IconButton>
                    )}
                    <IconButton label="Fechar o atendimento" variant="ghost" size="sm" onClick={close}>
                      <XIcon />
                    </IconButton>
                  </span>
                }
              />
            )}
            {(side || dialogTab === "profile") && (
              <aside className={styles.workspaceProfile} aria-label="Ficha da resposta">
                {!side && (
                  <div className={styles.profileBack}>
                    <Segmented
                      label="Atendimento ou ficha"
                      value={dialogTab}
                      onChange={setDialogTab}
                      options={[
                        { value: "thread", label: "Atendimento", icon: <ChatsCircleIcon aria-hidden="true" /> },
                        { value: "profile", label: "Ficha", icon: <IdentificationCardIcon aria-hidden="true" /> },
                      ]}
                    />
                    <IconButton label="Fechar o atendimento" variant="ghost" size="sm" onClick={close}>
                      <XIcon />
                    </IconButton>
                  </div>
                )}
                <ResponseProfile response={openedResponse} client={openedIdentity?.client} survey={surveysById.get(openedResponse.surveyId)} history={history} />
              </aside>
            )}
          </div>
        </Dialog>
      )}

      <ResolveDialog
        open={resolving !== null}
        name={resolvingName}
        onClose={() => setResolvingId(null)}
        onResolve={(recovered) => {
          if (resolving) save(setTreatmentStatus(resolving, "resolved", new Date().toISOString(), recovered));
          setResolvingId(null);
        }}
      />
    </div>
  );
}
