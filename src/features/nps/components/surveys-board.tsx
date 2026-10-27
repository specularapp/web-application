"use client";

import { ArchiveIcon, CardsIcon, ChatCircleTextIcon, ChatTextIcon, CopyIcon, FlagIcon, LinkIcon, ListChecksIcon, PauseIcon, PencilSimpleIcon, PlayIcon, PlusIcon, QuotesIcon, TableIcon, TrashIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { NameDialog } from "@/components/ui/name-dialog";
import { Text } from "@/components/ui/text";
import { slugify } from "@/lib/utils/slug";
import { dateLabel, fillSurveyText, formatCount, formatNps, groupLabels, groupOf, groups, npsOf, plural, serviceLabels, surveyStatusLabels, surveyStatusOrder, timeAgo, zoneOf } from "../labels";
import type { NpsData, NpsGroup, Survey, SurveyStatus } from "../types";
import { NPS_BASE, SharesBar } from "./parts";
import styles from "./surveys.module.css";

type View = "cards" | "table";

type SurveySummary = Survey & {
  responses: number;
  nps: number | null;
  shares: Record<NpsGroup, number>;
  respondents: { id: string; name: string }[];
  lastAnswerAt: string | null;
};

const servicesLabel = (survey: Survey) => (survey.services.length >= 4 ? "Todos os projetos" : survey.services.map((service) => serviceLabels[service].label).join(", "));

/**
 * As pesquisas de NPS no padrão das listas da casa: a barra com busca, filtro de situação, cartões ou tabela e
 * "Nova pesquisa". O cartão mostra a saudação, o que a pesquisa faz em linhas com o fio, o NPS com a barra das
 * faixas e, no pé, as respostas com os rostos de quem respondeu. O cartão e a linha abrem o editor.
 */
export function SurveysBoard({ data }: { data: NpsData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [surveys, setSurveys] = useState(data.surveys);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SurveyStatus | "all">("all");
  const [view, setView] = useState<View>("cards");
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<SurveySummary | null>(null);

  const summaries = useMemo<SurveySummary[]>(() => {
    const clientsById = new Map(data.clients.map((client) => [client.id, client]));
    return surveys.map((survey) => {
      const rows = data.responses.filter((response) => response.surveyId === survey.id);
      const counts = { promoter: 0, passive: 0, detractor: 0 };
      for (const row of rows) counts[groupOf(row.score)] += 1;
      const seen = new Set<string>();
      const respondents: { id: string; name: string }[] = [];
      for (const row of rows) {
        const client = clientsById.get(row.clientId);
        if (!client || seen.has(client.id) || respondents.length >= 4) continue;
        seen.add(client.id);
        respondents.push({ id: client.id, name: client.contact.name });
      }
      return { ...survey, responses: rows.length, nps: npsOf(rows.map((row) => row.score)), shares: counts, respondents, lastAnswerAt: rows[0]?.answeredAt ?? null };
    });
  }, [surveys, data.responses, data.clients]);

  const visible = useMemo(() => {
    const term = slugify(search.trim(), 80);
    return summaries
      .filter((survey) => (status === "all" || survey.status === status) && (!term || slugify(`${survey.name} ${servicesLabel(survey)}`, 200).includes(term)))
      .toSorted((a, b) => surveyStatusOrder.indexOf(a.status) - surveyStatusOrder.indexOf(b.status) || b.responses - a.responses);
  }, [summaries, search, status]);

  const changeStatus = (survey: Survey, next: SurveyStatus) => {
    setSurveys((current) => current.map((item) => (item.id === survey.id ? { ...item, status: next } : item)));
    const copy = { active: ["Pesquisa ativa", "Os links já aceitam respostas."], paused: ["Pesquisa pausada", "Os links param de aceitar respostas até reativar."], archived: ["Pesquisa arquivada", "As respostas continuam no painel."], draft: ["Pesquisa em rascunho", "Ela sai do ar até ser ativada."] }[next];
    toast({ title: copy[0], description: copy[1], tone: "success", feedback: false });
  };

  const duplicate = (survey: Survey) => {
    const id = `${survey.id}-copia-${surveys.length + 1}`;
    setSurveys((current) => [...current, { ...survey, id, name: `${survey.name} (cópia)`, status: "draft", updatedAt: data.now, updatedBy: "Você" }]);
    toast({ title: "Pesquisa duplicada", description: `A cópia de “${survey.name}” nasceu como rascunho.`, tone: "success", feedback: false });
  };

  const menu = (survey: SurveySummary): DropdownSection[] => [
    {
      id: "open",
      items: [
        { id: "edit", label: "Editar pesquisa", icon: PencilSimpleIcon, href: `${NPS_BASE}/pesquisas/${survey.id}` as Route },
        { id: "responses", label: "Ver respostas", icon: ChatTextIcon, href: `${NPS_BASE}/respostas` as Route, count: survey.responses },
      ],
    },
    {
      id: "state",
      label: "Situação",
      items: [
        ...(survey.status !== "active" && survey.status !== "archived" ? [{ id: "activate", label: "Ativar", icon: PlayIcon, onSelect: () => changeStatus(survey, "active") }] : []),
        ...(survey.status === "active" ? [{ id: "pause", label: "Pausar", icon: PauseIcon, onSelect: () => changeStatus(survey, "paused") }] : []),
        ...(survey.status === "archived" ? [{ id: "restore", label: "Voltar para rascunho", icon: PencilSimpleIcon, onSelect: () => changeStatus(survey, "draft") }] : []),
      ],
    },
    { id: "more", label: "Mais ações", items: [{ id: "duplicate", label: "Duplicar", icon: CopyIcon, onSelect: () => duplicate(survey) }] },
    {
      id: "danger",
      items: [
        ...(survey.status !== "archived" ? [{ id: "archive", label: "Arquivar", icon: ArchiveIcon, onSelect: () => changeStatus(survey, "archived") }] : []),
        { id: "delete", label: "Excluir pesquisa", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving(survey) },
      ],
    },
  ].filter((section) => section.items.length > 0);

  const actionsOf = (survey: SurveySummary) => <DropdownMenu label={`Ações de ${survey.name}`} triggerLabel={`Abrir ações de ${survey.name}`} sections={menu(survey)} />;
  const swatch = (survey: Survey) => (
    <span className={styles.swatch} style={{ "--swatch": survey.accent } as CSSProperties}>
      <ChatCircleTextIcon weight="fill" />
    </span>
  );
  const faces = (survey: SurveySummary) =>
    survey.respondents.length > 0 && (
      <AvatarGroup>
        {survey.respondents.map((person) => (
          <Avatar key={person.id} name={person.name} seed={person.id} size="xs" />
        ))}
      </AvatarGroup>
    );
  const sharesLabel = (survey: SurveySummary) => groups.map((group) => `${groupLabels[group].plural}: ${survey.shares[group]}`).join(", ");

  const filtering = Boolean(search.trim()) || status !== "all";
  const clear = () => {
    setSearch("");
    setStatus("all");
  };

  const columns: DataTableColumn<SurveySummary>[] = [
    { id: "name", header: "Pesquisa", sortable: true, sortValue: (survey) => survey.name, cell: (survey) => <DataTableTitle title={survey.name} caption={plural(survey.questions.length, "pergunta", "perguntas")} media={swatch(survey)} href={`${NPS_BASE}/pesquisas/${survey.id}` as Route} /> },
    { id: "services", header: "Projetos", hideBelow: "lg", cell: (survey) => <Text as="span" variant="footnote" tone="secondary">{servicesLabel(survey)}</Text> },
    { id: "status", header: "Situação", sortable: true, sortValue: (survey) => surveyStatusOrder.indexOf(survey.status), cell: (survey) => <Badge tone={surveyStatusLabels[survey.status].tone} size="sm">{surveyStatusLabels[survey.status].label}</Badge> },
    {
      id: "nps",
      header: "NPS",
      sortable: true,
      sortValue: (survey) => survey.nps ?? -999,
      cell: (survey) =>
        survey.nps === null ? (
          <Text as="span" variant="footnote" tone="tertiary">Sem respostas</Text>
        ) : (
          <span className={styles.rowNps}>
            <strong>{formatNps(survey.nps)}</strong>
            <SharesBar shares={survey.shares} label={sharesLabel(survey)} />
          </span>
        ),
    },
    { id: "responses", header: "Respostas", align: "end", sortable: true, sortValue: (survey) => survey.responses, cell: (survey) => formatCount(survey.responses) },
    { id: "last", header: "Última resposta", hideBelow: "md", sortable: true, sortValue: (survey) => survey.lastAnswerAt ?? "", cell: (survey) => <Text as="span" variant="footnote" tone="secondary">{survey.lastAnswerAt ? dateLabel(survey.lastAnswerAt) : "Nenhuma"}</Text> },
  ];

  const empty = (
    <EmptyState icon={ListChecksIcon} title={filtering ? "Nenhuma pesquisa encontrada" : "Nenhuma pesquisa ainda"} description={filtering ? "Tente outro nome ou tire o filtro de situação." : "Comece pela pós-entrega: a nota de 0 a 10 e um comentário já dão o NPS."}>
      {filtering && (
        <Button variant="outline" size="sm" radius="md" onClick={clear}>
          Limpar busca
        </Button>
      )}
      <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
        Criar pesquisa
      </Button>
    </EmptyState>
  );

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: setSearch, label: "Buscar pesquisa por nome ou projeto", placeholder: "Buscar pesquisa" }}
        filters={[
          {
            id: "status",
            label: "Situação",
            items: [{ value: "all" as const, label: "Todas as situações" }, ...surveyStatusOrder.map((value) => ({ value, label: surveyStatusLabels[value].label }))].map((option) => ({
              id: `status-${option.value}`,
              label: option.label,
              icon: FlagIcon,
              count: option.value === "all" ? undefined : summaries.filter((survey) => survey.status === option.value).length,
              selected: status === option.value,
              keepOpen: true,
              onSelect: () => setStatus(option.value),
            })),
          },
        ]}
        activeFilters={status === "all" ? [] : [{ id: "status", label: surveyStatusLabels[status].label, icon: FlagIcon, onClear: () => setStatus("all") }]}
        view={{
          value: view,
          onChange: (next) => setView(next === "table" ? "table" : "cards"),
          label: "Jeito de ver as pesquisas",
          options: [
            { value: "cards", label: "Cartões", icon: <CardsIcon /> },
            { value: "table", label: "Tabela", icon: <TableIcon /> },
          ],
        }}
        action={
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
            Nova pesquisa
          </Button>
        }
      />

      <div className={styles.content}>
        {visible.length === 0 ? (
          empty
        ) : view === "table" ? (
          <DataTable label="Pesquisas de NPS" rows={visible} rowKey={(survey) => survey.id} columns={columns} onRowClick={(survey) => router.push(`${NPS_BASE}/pesquisas/${survey.id}` as Route)} actions={actionsOf} empty={empty} />
        ) : (
          <ul className={styles.grid}>
            {visible.map((survey) => {
              const zone = survey.nps === null ? null : zoneOf(survey.nps);
              return (
                <li key={survey.id}>
                  <Card as="article" title={survey.name} icon={swatch(survey)} action={actionsOf(survey)} heading="h2">
                    <Link href={`${NPS_BASE}/pesquisas/${survey.id}` as Route} className={styles.cardMain} aria-label={`Editar ${survey.name}`}>
                      <p className={styles.intro}>{fillSurveyText(survey.intro, { name: null, project: "seu projeto" })}</p>
                      <ul className={styles.rules}>
                        <li>{servicesLabel(survey)}</li>
                        <li>{plural(survey.questions.length, "pergunta", "perguntas")}, {plural(survey.questions.filter((question) => question.kind === "stars").length, "aspecto em estrelas", "aspectos em estrelas")}</li>
                        <li>
                          <LinkIcon aria-hidden="true" />
                          {survey.publicLink ? "Link aberto, além do envio" : "Só pelo link pessoal de cada envio"}
                        </li>
                        <li>
                          <QuotesIcon aria-hidden="true" />
                          {survey.testimonial ? "Promotor é convidado a deixar depoimento" : "Sem convite para depoimento"}
                        </li>
                      </ul>
                      <div className={styles.score}>
                        <span className={styles.scoreHead}>
                          <strong>{survey.nps === null ? "Sem NPS" : formatNps(survey.nps)}</strong>
                          {zone ? (
                            <Badge tone={zone.tone} size="sm">
                              {zone.label}
                            </Badge>
                          ) : (
                            <small>Nenhuma resposta ainda</small>
                          )}
                        </span>
                        <SharesBar shares={survey.shares} label={sharesLabel(survey)} />
                      </div>
                      <span className={styles.edited}>
                        Editada por {survey.updatedBy}, {timeAgo(survey.updatedAt, data.now)}
                      </span>
                      <span className={styles.foot}>
                        <span className={styles.count}>
                          <strong>{formatCount(survey.responses)}</strong>
                          {survey.responses === 1 ? "resposta" : "respostas"}
                        </span>
                        {faces(survey)}
                        <Badge tone={surveyStatusLabels[survey.status].tone} size="sm">
                          {surveyStatusLabels[survey.status].label}
                        </Badge>
                      </span>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NameDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova pesquisa"
        description="Ela nasce como rascunho, com a nota de 0 a 10 e um comentário."
        placeholder="Pós-entrega, Suporte, Primeira semana"
        maxLength={60}
        confirmLabel="Criar e editar"
        pendingLabel="Criando"
        onSubmit={async (name) => {
          if (name.trim().length < 3) return "Dê um nome de pelo menos 3 letras.";
          router.push(`${NPS_BASE}/pesquisas/nova?nome=${encodeURIComponent(name.trim())}` as Route);
          return undefined;
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Excluir esta pesquisa?"
        description={removing ? (removing.responses > 0 ? `“${removing.name}” tem ${plural(removing.responses, "resposta", "respostas")}. Elas saem do painel junto com a pesquisa; arquivar guarda tudo.` : `“${removing.name}” sai da lista.`) : ""}
        confirmLabel="Excluir"
        pendingLabel="Excluindo"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            setSurveys((current) => current.filter((survey) => survey.id !== removing.id));
            toast({ title: "Pesquisa excluída", description: removing.name, tone: "success", feedback: false });
          }
          setRemoving(null);
        }}
      />
    </div>
  );
}
