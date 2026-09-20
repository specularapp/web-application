"use client";

import { AddressBookIcon, GlobeSimpleIcon, KanbanIcon, PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { SheetSwitcher } from "@/components/ui/sheet-switcher";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { loadProjectAction } from "../actions";
import { siteLabel } from "../labels";
import { type Project, type ProjectDetails } from "../summary";
import { ProjectMenu } from "./project-menu";
import { ProjectSheet } from "./project-sheet";
import styles from "./project-dialog.module.css";

export type ProjectDialogProps = {
  /** O projeto aberto; nulo mantém a janela montada e fechada, para a saída animar. */
  project: Project | null;
  onClose: () => void;
  /** Abre a ficha para editar, por cima da janela. */
  onEdit: (project: Project) => void;
  /** Pede a exclusão do projeto aberto; quem confirma é a prancha. */
  onDelete?: (project: Project) => void;
};

/** Quanto o dedo precisa andar na horizontal para o arrasto virar troca de metade, e não rolagem torta. */
const SWIPE = 56;

/** Qual metade da janela está à vista no celular, onde as duas não cabem lado a lado. */
type ProjectTab = "details" | "activity";

/* As duas metades no seletor que flutua acima da bandeja, no celular, com os mesmos nomes da ficha da tarefa. */
const projectTabs = [
  { id: "details", label: "Informações" },
  { id: "activity", label: "Atividade" },
] as const satisfies readonly { id: ProjectTab; label: string }[];

const whenLabel = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });
const firstName = (name: string) => name.split(" ")[0] ?? name;

// A janela do projeto (2026-09-13, a pedido): a moldura de trabalho da casa, a `Dialog` `xl` centrada, a
// mesma do editor de orçamento e da ficha da tarefa, porque a ficha é grande e é onde o projeto se liga ao
// resto do sistema. À esquerda a ficha: a capa, quem contratou com o nome, a situação e a etiqueta de público,
// os atalhos só em glifo (o site, editar e o quadro de tarefas; a versão com texto durou uma rodada e saiu a
// pedido), a descrição, os números em azulejo e as seções nos primitivos de perfil da casa (detalhes,
// ferramentas, etiquetas, tarefas, orçamentos, contratos e cobranças). À direita, numa coluna própria, a
// equipe e a atividade recente. Entre 48 e 64rem a coluna desce para baixo da ficha e tudo rola junto.
//
// **No celular a janela segue a ficha da tarefa** (a pedido, 2026-09-13): a bandeja da casa mostra uma metade
// por vez, Informações ou Atividade, trocadas pelo seletor que flutua acima da bandeja (`SheetSwitcher`, pela
// prop `above` da `Dialog`) ou pelo arrasto para o lado; os atalhos saem da identidade, porque as ações moram
// na barra flutuante. Toda abertura começa em Informações: a janela é uma só para a grade inteira, e sem
// isso quem tivesse ido para a atividade abriria o projeto seguinte já nela.
//
// Uma janela só para a grade inteira, guardando quem está aberto: com doze cartões seriam doze janelas
// montadas, a mesma decisão da ficha do cliente. A ficha completa é buscada ao abrir, e o cabeçalho já
// mostra o que o cartão sabia, então a janela nunca abre vazia.
export function ProjectDialog({ project, onClose, onEdit, onDelete }: ProjectDialogProps) {
  /* A metade à vista mora aqui, e não no miolo, porque o seletor que a troca é desenhado pela `Dialog` fora da
     bandeja. Volta para Informações a cada projeto novo, ajustado durante o render, como o React pede. */
  const [tab, setTab] = useState<ProjectTab>("details");
  const [seen, setSeen] = useState(project?.id);
  if (project && project.id !== seen) {
    setSeen(project.id);
    setTab("details");
  }

  return (
    <Dialog
      open={Boolean(project)}
      onClose={onClose}
      label={project ? `Projeto ${project.name}` : "Projeto"}
      size="xl"
      focusOnOpen={false}
      above={project && <SheetSwitcher label="O que ver do projeto" options={projectTabs} value={tab} onChange={setTab} />}
    >
      {project && (
        <ProjectDetail
          key={project.id}
          project={project}
          tab={tab}
          onTabChange={setTab}
          onClose={onClose}
          onEdit={() => onEdit(project)}
          onDelete={onDelete ? () => onDelete(project) : undefined}
        />
      )}
    </Dialog>
  );
}
type ProjectDetailProps = {
  project: Project;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  onClose: () => void;
  onEdit: () => void;
  /** Pede a exclusão; quem confirma é a prancha. */
  onDelete?: () => void;
};

function ProjectDetail({ project, tab, onTabChange, onClose, onEdit, onDelete }: ProjectDetailProps) {
  const router = useRouter();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [full, setFull] = useState<ProjectDetails | null>(null);
  const board = `/tarefas/${project.slug}` as Route;
  const site = project.url;

  /* O arrasto para o lado que vira a metade, na receita da ficha da tarefa: puxar para a esquerda vai para a
     atividade e para a direita volta para a ficha. A conta é feita no soltar: o dedo precisa andar `SWIPE` na
     horizontal e menos que isso na vertical, senão a rolagem viraria troca de metade no primeiro deslize
     torto; gesto que nasce num controle é do controle, e não da janela. */
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const onSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const from = event.target as HTMLElement;
    if (from.closest("input, textarea, button, a, [role='button'], [role='menuitem']")) return;
    swipe.current = { x: event.clientX, y: event.clientY };
  };

  const onSwipeCancel = () => {
    swipe.current = null;
  };

  const onSwipeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const moveX = event.clientX - from.x;
    const moveY = event.clientY - from.y;
    if (Math.abs(moveX) < SWIPE || Math.abs(moveY) > Math.abs(moveX)) return;
    onTabChange(moveX < 0 ? "activity" : "details");
  };

  // Refeita a cada projeto novo que chega, e não só a cada id: depois de editar, o projeto volta do servidor
  // como outro objeto com o mesmo id, e a ficha completa acompanha sem piscar, porque a anterior fica no
  // lugar até a nova chegar.
  useEffect(() => {
    let current = true;
    void loadProjectAction(project.id).then((data) => {
      if (current) setFull(data);
    });
    return () => {
      current = false;
    };
  }, [project]);

  /* No celular as ações da janela moram na barra flutuante, no contrato de toda janela da casa: o quadro de
     tarefas como principal, que é para onde se vai a partir do projeto ("Tarefas", curto, porque a barra
     divide a largura da tela com duas secundárias e o sair), editar e o site em glifo, e o X que fecha.
     Registrado aqui dentro, e não em quem monta a janela, porque a barra elege quem registrou na maior
     profundidade. */
  useFloatingActionsRegistration(
    mobile
      ? {
          primary: { label: "Tarefas", icon: <KanbanIcon weight="bold" />, onClick: () => router.push(board) },
          extras: [
            { label: "Editar projeto", icon: <PencilSimpleIcon weight="bold" />, onClick: onEdit },
            ...(site ? [{ label: `Abrir ${siteLabel(site)}`, icon: <GlobeSimpleIcon weight="bold" />, onClick: () => window.open(site, "_blank", "noreferrer") }] : []),
          ],
          cancel: { label: "Fechar projeto", onClick: onClose },
        }
      : null,
  );

  return (
    <div className={styles.dialog}>
      <header className={styles.top}>
        <nav className={styles.route} aria-label="Onde o projeto mora">
          <Link href="/projetos" className={styles.crumb}>
            Projetos
          </Link>
          {/* O degrau do cliente só existe quando há cliente: projeto independente vem da lista e para nela. */}
          {project.client && (
            <>
              <span className={styles.slash} aria-hidden="true">
                /
              </span>
              <Link href={`/clientes/${project.client.id}` as Route} className={styles.crumb}>
                <AddressBookIcon aria-hidden="true" />
                {project.client.company ?? project.client.name}
              </Link>
            </>
          )}
          <Badge tone="neutral" variant="soft" size="sm" className={styles.reference}>
            {project.reference}
          </Badge>
        </nav>
        <div className={styles.actions}>
          <ProjectMenu project={project} onEdit={onEdit} onDelete={onDelete} />
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body} data-tab={tab} onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} onPointerCancel={onSwipeCancel}>
        <ProjectSheet project={project} details={full} onEdit={onEdit} />

        {/* A coluna lateral: quem está no projeto e o que aconteceu por último nas tarefas dele. */}
        <aside className={styles.side} aria-label="Equipe e atividade do projeto">
          {full && (
            <>
              <section className={styles.sideBlock} aria-labelledby="project-people">
                <Text as="h3" id="project-people" variant="callout" weight="semibold">
                  Equipe
                </Text>
                <ul className={styles.people}>
                  {full.people.map((person) => (
                    <li key={person.id} className={styles.person}>
                      <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="sm" />
                      <span className={styles.personCopy}>
                        <Text as="span" variant="footnote" weight="medium" truncate>
                          {person.name}
                        </Text>
                        <Text as="span" variant="caption1" tone="secondary" truncate>
                          {person.role}
                        </Text>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.sideBlock} aria-labelledby="project-activity">
                <Text as="h3" id="project-activity" variant="callout" weight="semibold">
                  Atividade
                </Text>
                {full.activity.length === 0 ? (
                  <Text variant="footnote" tone="secondary">
                    Nada registrado ainda
                  </Text>
                ) : (
                  <ol className={styles.events}>
                    {full.activity.map((event) => (
                      <li key={event.id} className={styles.event}>
                        <Avatar name={event.person.name} src={event.person.avatarUrl ?? undefined} size="xs" />
                        <div className={styles.eventCopy}>
                          <Text as="p" variant="footnote">
                            <Text as="span" variant="footnote" weight="medium">
                              {firstName(event.person.name)}
                            </Text>{" "}
                            {event.action}
                            {event.task && (
                              <Text as="span" variant="footnote" tone="secondary">
                                {" "}
                                em {event.task}
                              </Text>
                            )}
                          </Text>
                          <time dateTime={event.at}>
                            <Text as="span" variant="caption1" tone="tertiary">
                              {whenLabel(event.at)}
                            </Text>
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
