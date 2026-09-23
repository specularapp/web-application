"use client";

import { ArrowCounterClockwiseIcon, FlowArrowIcon, PlusIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { deleteAutomationAction, duplicateAutomationAction, setAutomationStatusAction, testAutomationAction } from "../actions";
import { automationStatuses } from "../labels";
import { QUERY_PARAM, STATUS_PARAM, activeAutomationsFilters, clearedFilters, defaultQuery, statusFilterLabels, statusFilterValues, type AutomationsListPage, type AutomationsQuery } from "../list-options";
import type { Automation, AutomationRun } from "../summary";
import { AutomationCard } from "./automation-card";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import styles from "./automations-board.module.css";

/* A automação nova e o registro de execuções entram por importação dinâmica, montados só na primeira
   abertura (varredura de peso de 2026-09-21). */
const NewAutomationDialog = dynamic(() => import("./new-automation-dialog").then((module) => module.NewAutomationDialog));
const RunLogDialog = dynamic(() => import("./run-log-dialog").then((module) => module.RunLogDialog));
import { callAction } from "@/lib/action";

export type AutomationsBoardProps = {
  page: AutomationsListPage;
  query: AutomationsQuery;
  /** A janela de criar já aberta, quando a URL é `/automacoes/nova`. */
  creating?: boolean;
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

const pathOf = (creating: boolean) => (creating ? "/automacoes/nova" : "/automacoes");

type LogState = { automation: Automation; highlight: string | null } | null;

// A prancha de automações (2026-09-15, a pedido, sobre as referências n8n e Make do usuário): a barra de
// busca e filtros em cima e a grade de cartões, na mesma estrutura das outras listas da casa. O filtro vive
// na URL e quem faz o trabalho é o servidor. Aqui ficam a espera do campo de busca, o filtro adiantado, a
// janela de criar (com endereço próprio, `/automacoes/nova`), as ações do leque de cada cartão (ativar,
// pausar, testar, duplicar, excluir) e o histórico de execuções em gaveta. Abrir um cartão leva ao editor,
// que é uma tela.
export function AutomationsBoard({ page, query, creating: initialCreating = false }: AutomationsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(query.search);
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typing.current), []);

  const [creating, setCreating] = useState(initialCreating);
  // Atualização da lista não manda na janela. Só uma navegação que altere a prop da rota pode abri-la ou
  // fechá-la, evitando o lampejo de recarregar a página antes de mostrar o diálogo.
  const [seenCreating, setSeenCreating] = useState(initialCreating);
  if (seenCreating !== initialCreating) {
    setSeenCreating(initialCreating);
    setCreating(initialCreating);
  }

  useEffect(() => {
    const onPopState = () => setCreating(window.location.pathname.split("/")[2] === "nova");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const show = (next: boolean) => {
    setCreating(next);
    window.history.pushState(null, "", `${pathOf(next)}${window.location.search}`);
  };

  const open = (automation: Automation) => router.push(`/automacoes/${automation.id}` as Route);

  const created = (id: string) => {
    setCreating(false);
    router.push(`/automacoes/${id}` as Route);
  };

  const [toggling, setToggling] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, Automation>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const items = page.items.map((automation) => optimistic[automation.id] ?? automation).filter((automation) => !hidden.includes(automation.id));
  const toggle = async (automation: Automation) => {
    const status = automation.status === "active" ? "paused" : "active";
    setOptimistic((current) => ({ ...current, [automation.id]: { ...automation, status } }));
    setToggling(automation.id);
    const result = await callAction(setAutomationStatusAction({ id: automation.id, status }));
    setToggling(null);
    if (!result.ok) {
      setOptimistic((current) => {
        const next = { ...current };
        delete next[automation.id];
        return next;
      });
      toast({ title: "Não deu para ativar", description: result.error, tone: "danger" });
      return;
    }
    setOptimistic((current) => ({ ...current, [automation.id]: result.automation }));
    toast({ title: result.automation.status === "active" ? "Automação ativa" : "Automação pausada", description: result.automation.status === "active" ? `${automation.name} roda sozinha a partir de agora.` : `${automation.name} guarda o fluxo, mas não roda.`, tone: result.automation.status === "active" ? "success" : "neutral" });
  };

  const duplicate = async (automation: Automation) => {
    const result = await callAction(duplicateAutomationAction({ id: automation.id }));
    if (!result.ok) {
      toast({ title: "Não deu para duplicar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Automação duplicada", description: "A cópia nasceu pausada, para você mexer antes de ativar.", tone: "success" });
  };

  const [log, setLog] = useState<LogState>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const test = async (automation: Automation) => {
    setTesting(automation.id);
    const result = await callAction(testAutomationAction({ id: automation.id }));
    setTesting(null);
    if (!result.ok) {
      toast({ title: "Não deu para testar", description: result.error, tone: "danger" });
      return;
    }
    const run: AutomationRun = result.run;
    toast({
      title: run.status === "failed" ? "O teste falhou num passo" : "Teste concluído",
      description: `${run.steps.length} ${run.steps.length === 1 ? "passo" : "passos"}. Veja o registro de cada um.`,
      tone: run.status === "failed" ? "warning" : "success",
    });
    setLog({ automation: result.automation, highlight: run.id });
  };

  const [deleting, setDeleting] = useState<Automation | null>(null);
  const [removing, setRemoving] = useState(false);
  /* As janelas pesadas nascem só na primeira abertura, e seguem montadas depois, para a saída animar. */
  const createReady = useOpenedOnce(creating);
  const logReady = useOpenedOnce(log !== null);
  const remove = async () => {
    if (!deleting) return;
    const target = deleting;
    setHidden((current) => [...new Set([...current, target.id])]);
    setDeleting(null);
    setRemoving(true);
    const result = await callAction(deleteAutomationAction({ id: target.id }));
    setRemoving(false);
    if (!result.ok) {
      setHidden((current) => current.filter((id) => id !== target.id));
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Automação excluída", description: `${target.name} saiu da conta.`, tone: "neutral" });
  };

  const go = useCallback(
    (next: Partial<AutomationsQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      const search = params.toString();
      const base = pathOf(creating);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [live, creating, router],
  );

  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value }), TYPING_PAUSE);
  };

  const active = activeAutomationsFilters(live);
  const filtering = Boolean(live.search) || active.length > 0;
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "" });
  };

  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: statusFilterValues.map((value) => ({
        id: `status-${value}`,
        label: statusFilterLabels[value],
        icon: value === "todas" ? undefined : automationStatuses[value].icon,
        count: value === "todas" ? undefined : page.counts[value],
        selected: live.status === value,
        keepOpen: true,
        onSelect: () => go({ status: value }),
      })),
    },
    ...(active.length > 0 ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedFilters) }] }] : []),
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: onSearch, placeholder: "Buscar automações", label: "Buscar automação por nome, descrição ou passo" }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({ id: filter.id, label: filter.label, icon: filter.icon, onClear: () => go(filter.clear) }))}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(true)}>
                Nova automação
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Nova automação" size="sm" radius="md" onClick={() => show(true)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <div className={styles.scrollArea}>
        {items.length === 0 ? (
          <EmptyState
            icon={FlowArrowIcon}
            title={filtering ? "Nenhuma automação encontrada" : "Nenhuma automação ainda"}
            description={
              filtering
                ? "Nada bateu com o que você procurou. Tente outro nome ou passo, ou limpe a busca."
                : "Crie a primeira automação do zero ou comece por um modelo da casa: cobrança, lembrete de contrato, boas-vindas."
            }
          >
            {filtering && (
              <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
                Limpar busca
              </Button>
            )}
            <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(true)}>
              Nova automação
            </Button>
          </EmptyState>
        ) : (
          <ul className={styles.grid}>
            {items.map((automation) => (
              <li key={automation.id}>
                <AutomationCard
                  automation={automation}
                  toggling={toggling === automation.id}
                  onOpen={() => open(automation)}
                  onEdit={() => open(automation)}
                  onTest={testing ? undefined : () => void test(automation)}
                  onToggle={() => void toggle(automation)}
                  onDuplicate={() => void duplicate(automation)}
                  onHistory={() => setLog({ automation, highlight: null })}
                  onDelete={() => setDeleting(automation)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {createReady && (
        <NewAutomationDialog open={creating} installed={page.installed} onClose={() => show(false)} onCreated={created} />
      )}

      {logReady && (
        <RunLogDialog open={log !== null} onClose={() => setLog(null)} name={log?.automation.name ?? ""} runs={log?.automation.runs ?? []} highlight={log?.highlight} />
      )}

      <ConfirmDialog
        open={deleting !== null}
        pending={removing}
        title={`Excluir ${deleting?.name ?? "automação"}?`}
        description="O fluxo e o histórico de execuções saem da conta. Se ela estiver ativa, para de rodar na hora."
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
