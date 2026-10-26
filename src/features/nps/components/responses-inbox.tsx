"use client";

import styled from "@emotion/styled";
import { ArrowLeftIcon, ChatsCircleIcon, IdentificationCardIcon, MagnifyingGlassIcon, SlidersHorizontalIcon, TimerIcon, UserIcon, XIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { slugify } from "@/lib/utils/slug";
import { periodLabels, type NpsPeriod } from "../analytics";
import { DAY, channelLabels, formatCount, formatNps, groupOf, npsOf, serviceLabels, services, timeAgo, treatmentIsOpen, treatmentLabels } from "../labels";
import { openTreatment } from "../treatments";
import type { NpsChannel, NpsData, NpsResponse, NpsService, Treatment } from "../types";
import { NPS_BASE, ScoreBubble } from "./parts";
import { ResponseProfile, ResponseThread } from "./response-thread";
import styles from "./responses.module.css";
import { Segmented } from "./segmented";

type Cut = "all" | "waiting" | "detractor" | "passive" | "promoter" | "comment";

const PAGE = 30;
const WIDE_QUERY = "(min-width: 80rem)";
const periods: NpsPeriod[] = ["30", "90", "180", "365", "all"];

const RowButton = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-body);
  color: var(--color-label);
  text-align: start;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  transition: background-color var(--duration-fast) var(--ease-standard);

  &:hover {
    background-color: var(--color-fill-quaternary);
  }

  &[aria-current="true"] {
    background-color: var(--color-fill-tertiary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/**
 * As respostas do NPS no desenho de caixa de conversas: a fila à esquerda com os recortes (quem espera
 * atendimento sobe para o topo), o atendimento no meio e a ficha da resposta à direita. Abaixo de 80rem a
 * ficha vira gaveta; no celular a fila e o atendimento trocam de lugar.
 */
export function ResponsesInbox({ data, initialId }: { data: NpsData; initialId?: string }) {
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const wide = useMediaQuery(WIDE_QUERY);
  const [treatments, setTreatments] = useState(data.treatments);
  const [selected, setSelected] = useState<string | null>(initialId && data.responses.some((response) => response.id === initialId) ? initialId : null);
  const [threadOpen, setThreadOpen] = useState(Boolean(initialId));
  const [profileOpen, setProfileOpen] = useState(false);
  const [cut, setCut] = useState<Cut>("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<NpsPeriod>("90");
  const [channels, setChannels] = useState<NpsChannel[]>([]);
  const [service, setService] = useState<NpsService | "all">("all");
  const [limit, setLimit] = useState(PAGE);

  const clientsById = useMemo(() => new Map(data.clients.map((client) => [client.id, client])), [data.clients]);
  const surveysById = useMemo(() => new Map(data.surveys.map((survey) => [survey.id, survey])), [data.surveys]);
  const treatmentsById = useMemo(() => new Map(treatments.map((treatment) => [treatment.id, treatment])), [treatments]);
  const treatmentByResponse = useMemo(() => new Map(treatments.map((treatment) => [treatment.responseId, treatment])), [treatments]);
  const treatmentOf = (response: NpsResponse) => treatmentByResponse.get(response.id) ?? (response.treatmentId ? (treatmentsById.get(response.treatmentId) ?? null) : null);
  const waiting = (response: NpsResponse) => {
    const treatment = treatmentOf(response);
    return treatment ? treatment.status === "open" : groupOf(response.score) === "detractor";
  };

  const filtered = useMemo(() => {
    const term = slugify(search.trim(), 80);
    const since = period === "all" ? 0 : Date.parse(data.now) - Number(period) * DAY;
    return data.responses.filter((response) => {
      const client = clientsById.get(response.clientId);
      if (Date.parse(response.answeredAt) < since) return false;
      if (channels.length > 0 && !channels.includes(response.channel)) return false;
      if (service !== "all" && client?.project.service !== service) return false;
      if (term && !slugify(`${client?.contact.name} ${client?.contact.company} ${client?.project.name} ${response.comment}`, 600).includes(term)) return false;
      return true;
    });
  }, [data.responses, data.now, clientsById, search, period, channels, service]);

  const tests: Record<Cut, (response: NpsResponse) => boolean> = {
    all: () => true,
    waiting,
    detractor: (response) => groupOf(response.score) === "detractor",
    passive: (response) => groupOf(response.score) === "passive",
    promoter: (response) => groupOf(response.score) === "promoter",
    comment: (response) => response.comment.trim().length > 0,
  };
  const visible = filtered.filter(tests[cut]);
  const queue = visible.filter(waiting).toSorted((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  const recent = visible.filter((response) => !waiting(response));
  const count = (key: Cut) => filtered.filter(tests[key]).length;

  const activeId = selected && data.responses.some((response) => response.id === selected) ? selected : !mobile ? ((queue[0] ?? recent[0])?.id ?? null) : null;
  const active = data.responses.find((response) => response.id === activeId) ?? null;
  const activeClient = active ? clientsById.get(active.clientId) : undefined;
  const activeSurvey = active ? surveysById.get(active.surveyId) : undefined;
  const history = active ? data.responses.filter((response) => response.clientId === active.clientId) : [];

  const select = (id: string) => {
    setSelected(id);
    setThreadOpen(true);
    window.history.replaceState(null, "", `${NPS_BASE}/respostas?id=${id}`);
  };

  const saveTreatment = (treatment: Treatment) => setTreatments((list) => (list.some((item) => item.id === treatment.id) ? list.map((item) => (item.id === treatment.id ? treatment : item)) : [...list, treatment]));

  const filterCount = (period !== "90" ? 1 : 0) + channels.length + (service !== "all" ? 1 : 0);
  const filtering = filterCount > 0 || Boolean(search.trim()) || cut !== "all";
  const clear = () => {
    setPeriod("90");
    setChannels([]);
    setService("all");
    setSearch("");
    setCut("all");
  };

  const filterSections: DropdownSection[] = [
    ...(filterCount > 0 ? [{ id: "clear", items: [{ id: "clear", label: "Limpar filtros", icon: XIcon, onSelect: clear }] }] : []),
    { id: "period", label: "Respondida em", items: periods.map((value) => ({ id: `period-${value}`, label: periodLabels[value], selected: period === value, keepOpen: true, onSelect: () => setPeriod(value) })) },
    { id: "channel", label: "Canal", items: (Object.keys(channelLabels) as NpsChannel[]).map((value) => ({ kind: "toggle" as const, id: `channel-${value}`, label: channelLabels[value], checked: channels.includes(value), onChange: (on: boolean) => setChannels((list) => (on ? [...list, value] : list.filter((item) => item !== value))) })) },
    { id: "service", label: "Serviço", items: [{ value: "all" as const, label: "Todos os serviços" }, ...services.map((value) => ({ value, label: serviceLabels[value].label }))].map((option) => ({ id: `service-${option.value}`, label: option.label, selected: service === option.value, keepOpen: true, onSelect: () => setService(option.value) })) },
  ];

  const row = (response: NpsResponse) => {
    const client = clientsById.get(response.clientId);
    const treatment = treatmentOf(response);
    const isWaiting = waiting(response);
    return (
      <li key={response.id}>
        <RowButton type="button" aria-current={response.id === activeId || undefined} onClick={() => select(response.id)}>
          <Avatar name={client?.contact.name ?? "Cliente"} seed={response.clientId} size="sm" />
          <span className={styles.rowText}>
            <span className={styles.rowLine}>
              <strong data-unread={isWaiting || undefined}>{client?.contact.name ?? "Cliente"}</strong>
              <time dateTime={response.answeredAt}>{timeAgo(response.answeredAt, data.now)}</time>
            </span>
            <span className={styles.rowLine}>
              <span className={styles.preview}>{response.comment || `Nota ${response.score}, sem comentário`}</span>
              <span className={styles.flags}>
                {isWaiting && <TimerIcon aria-label="Aguardando atendimento" className={styles.waitingIcon} />}
                {treatment && treatment.status !== "open" && treatmentIsOpen(treatment.status) && <UserIcon weight="fill" aria-label={`Atendimento: ${treatmentLabels[treatment.status].label}`} />}
                <ScoreBubble score={response.score} size="sm" />
              </span>
            </span>
          </span>
        </RowButton>
      </li>
    );
  };

  const profile = active ? <ResponseProfile response={active} client={activeClient} survey={activeSurvey} history={history} onSelect={select} /> : null;
  const showList = !mobile || !threadOpen || !active;
  const showThread = !mobile || (threadOpen && active);

  return (
    <div className={styles.inbox} data-wide={wide || undefined}>
      {showList && (
        <aside className={styles.list} aria-label="Respostas">
          <div className={styles.listHead}>
            <div className={styles.searchRow}>
              <Input size="sm" type="search" value={search} placeholder="Buscar cliente, projeto ou comentário" aria-label="Buscar respostas" iconStart={<MagnifyingGlassIcon />} onChange={(event) => setSearch(event.target.value)} />
              <span className={styles.filterButton}>
                <DropdownMenu label="Filtros" triggerLabel={filterCount > 0 ? `Filtros, ${filterCount} em vigor` : "Filtrar respostas"} sections={filterSections} icon={<SlidersHorizontalIcon />} trigger={{ variant: "outline", radius: "md", foreground: "var(--color-label-secondary)" }} searchable={false} />
                {filterCount > 0 && (
                  <Badge tone="accent" size="sm" shape="pill" className={styles.filterCount} aria-hidden="true">
                    {filterCount}
                  </Badge>
                )}
              </span>
            </div>
            <Segmented
              as="radio"
              label="Recortes"
              value={cut}
              onChange={setCut}
              options={[
                { value: "all", label: "Todas" },
                { value: "waiting", label: "Aguardando", count: count("waiting") },
                { value: "detractor", label: "Detratores", count: count("detractor") },
                { value: "passive", label: "Neutros", count: count("passive") },
                { value: "promoter", label: "Promotores", count: count("promoter") },
                { value: "comment", label: "Com comentário", count: count("comment") },
              ]}
            />
            <p className={styles.summary}>
              <span>{visible.length === 1 ? "1 resposta" : `${formatCount(visible.length)} respostas`}</span>
              <span>NPS do recorte {formatNps(npsOf(visible.map((response) => response.score)))}</span>
            </p>
          </div>

          <div className={styles.listBody}>
            {visible.length === 0 ? (
              <EmptyState icon={ChatsCircleIcon} size="sm" title={filtering ? "Nenhuma resposta aqui" : "Nenhuma resposta ainda"} description={filtering ? "Ninguém combina com a busca, o recorte ou os filtros." : "Quando os clientes responderem, as respostas chegam aqui."}>
                {filtering ? (
                  <Button variant="outline" size="sm" radius="md" onClick={clear}>
                    Limpar busca e filtros
                  </Button>
                ) : (
                  <Button size="sm" radius="md" href={`${NPS_BASE}/disparos`}>
                    Ver disparos
                  </Button>
                )}
              </EmptyState>
            ) : (
              <>
                {queue.length > 0 && (
                  <section aria-label="Aguardando atendimento">
                    <h2 className={styles.groupTitle}>
                      Aguardando atendimento
                      <Badge size="sm" shape="pill" tone="danger">
                        {queue.length}
                      </Badge>
                    </h2>
                    <ul className={styles.rows}>{queue.map(row)}</ul>
                  </section>
                )}
                {recent.length > 0 && (
                  <section aria-label="Recentes">
                    <h2 className={styles.groupTitle}>Recentes</h2>
                    <ul className={styles.rows}>{recent.slice(0, limit).map(row)}</ul>
                    {limit < recent.length && (
                      <div className={styles.more}>
                        <Button variant="ghost" size="sm" onClick={() => setLimit((value) => value + PAGE)}>
                          Carregar mais
                        </Button>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {showThread &&
        (active ? (
          <ResponseThread
            key={active.id}
            response={active}
            client={activeClient}
            survey={activeSurvey}
            treatment={treatmentOf(active)}
            team={data.team}
            now={data.now}
            leading={
              mobile ? (
                <IconButton label="Voltar para a lista" variant="ghost" size="sm" onClick={() => setThreadOpen(false)}>
                  <ArrowLeftIcon />
                </IconButton>
              ) : undefined
            }
            trailing={
              !wide ? (
                <IconButton label="Abrir a ficha da resposta" variant="ghost" size="sm" onClick={() => setProfileOpen(true)}>
                  <IdentificationCardIcon />
                </IconButton>
              ) : undefined
            }
            onStart={() => {
              const treatment = openTreatment(active, new Date().toISOString(), treatments.length + 1);
              saveTreatment(treatment);
              toast({ title: "Atendimento iniciado", description: "A resposta já está na fila de tratativas.", tone: "success", feedback: false });
            }}
            onTreatment={saveTreatment}
          />
        ) : (
          <section className={styles.threadEmpty} aria-label="Atendimento">
            <EmptyState icon={ChatsCircleIcon} size="sm" title="Escolha uma resposta" description="O atendimento e a ficha da resposta aparecem aqui." />
          </section>
        ))}

      {wide && active && <aside className={styles.profilePanel} aria-label="Ficha da resposta">{profile}</aside>}

      {!wide && active && (
        <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} label="Ficha da resposta" placement="end" size="md" surface="page">
          <DialogHeader title="Ficha da resposta" onClose={() => setProfileOpen(false)} />
          <div className={styles.profileDialog}>{profile}</div>
        </Dialog>
      )}

    </div>
  );
}
