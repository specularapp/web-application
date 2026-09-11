"use client";

import {
  ArrowUpRightIcon,
  AtIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  HashIcon,
  ImageIcon,
  KanbanIcon,
  MicrophoneIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  StopIcon,
  TagIcon,
  TimerIcon,
  UserCircleIcon,
  UsersIcon,
  WarningIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useFloatingActionsRegistration, type FloatingActions } from "@/components/layout/floating-actions";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { DurationPicker } from "@/components/ui/duration-picker";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { RecordHoverCard } from "@/features/records/components/record-hover-card";
import { RecordMediaView } from "@/features/records/components/record-media";
import { RecordPicker } from "@/features/records/components/record-picker";
import { recordKinds, type AppRecord } from "@/features/records/records";
import { squircle } from "@/lib/corners";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { slugify } from "@/lib/utils/slug";
import { cx } from "@/lib/utils/cx";
import { acceptAny, acceptDocuments, acceptImages, attachmentOf } from "../files";
import { DAY_MINUTES, dueOf, estimateLabel, peopleLabel, priorityHues, priorityLabels, priorityTones } from "../labels";
import { linkKindValues, taskLinkKinds } from "../links";
import { defaultStages, taskStageMeta, type TaskStage } from "../stages";
import { tagGroups, tagHue, taskTags } from "../tags";
import type { Task, TaskAttachment, TaskAudio, TaskEvent, TaskLink, TaskMention, TaskPerson, TaskPriority } from "../summary";
import { AttachmentCard } from "./attachment-card";
import { AudioBubble, VoiceButton, useVoiceRecorder } from "./chat-audio";
import { Subtasks } from "./subtasks";
import { AttachmentDialog, LinkDialog } from "./task-add-dialogs";
import { TaskMenu } from "./task-menu";
import sheet from "./task-sheet.module.css";
import frame from "./task-dialog.module.css";

export type TaskDialogProps = {
  /** A tarefa aberta; nula mantém a janela montada e fechada, para a saída animar. */
  task: Task | null;
  open: boolean;
  onClose: () => void;
  /** As etapas que o quadro de onde ela veio oferece; sem elas valem as do catálogo padrão. */
  stages?: TaskStage[];
  /** Quem pode assumir a tarefa; sem a equipe, as opções são quem já está nela. */
  team?: TaskPerson[];
  /** O índice do que existe na aplicação, para vincular e para marcar no comentário. */
  records?: AppRecord[];
  /**
   * Avisa o quadro de que a etapa mudou aqui dentro (2026-09-11): sem isto a troca ficava só no rascunho da
   * ficha e a tarefa voltava para a coluna de origem ao fechar, o que no celular é o **único** caminho de
   * mover, porque ali não se arrasta.
   */
  onStageChange?: (stage: TaskStage) => void;
};

/** Quantos rostos a fila de envolvidos mostra antes de resumir o resto em "+N". */
const SHOWN_FACES = 4;

/** Teto do comentário, o mesmo que um campo de texto da casa aceita sem virar documento. */
const COMMENT_MAX = 600;

const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

/* A estimativa é escolhida em três grupos no mesmo menu (2026-09-10, a pedido de selecionar dia, hora e
   minuto): dez dias de trabalho, doze horas e o quarto de hora. Escolher um grupo não fecha o menu, então dá
   para acertar os três de uma vez. Tudo zero é "sem estimativa", porque estimar zero não diz nada. */

/* Os nomes ligados por "e" para a leitura por voz, como no cartão e na ficha. */
const nameList = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

const hourStamp = (iso: string) => format(parseISO(iso), "HH:mm", { locale: ptBR });

/* O nome do dia no separador da conversa: hoje e ontem por extenso, o resto pela data. */
function dayName(iso: string) {
  const date = parseISO(iso);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "EEEE, d 'de' MMM.", { locale: ptBR });
}
const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

/* Quem escreve enquanto o domínio não está no banco: o comentário é da sessão, então ele não tem autor de
   verdade para carregar. Com a tabela, quem assina é o visitante que a concha já conhece. */
const viewer: TaskPerson = { name: "Você", avatarUrl: null };

/* A bandeira e a bolinha no matiz certo, para o menu dizer qual é qual pela cor e não só pelo nome. */
const priorityMark = (priority: TaskPriority) => <FlagIcon weight="bold" style={{ color: priorityHues[priority] } as CSSProperties} />;
const tagMark = (id: string) => <span className={frame.dot} style={{ "--dot-hue": tagHue(id) } as CSSProperties} />;

/**
 * Texto que se edita no lugar (2026-09-10, a pedido): o valor é desenhado como sempre foi e, ao clique, o
 * mesmo texto vira campo, sem mudar de tamanho, de peso nem de posição. Sair do campo grava; `Esc` desfaz.
 *
 * O campo herda a tipografia de quem o contém (`font: inherit` dentro do `Text`), e é por isso que ele não
 * precisa repetir variante nem peso: copiar a escala à mão sairia de sincronia no primeiro acerto de
 * tipografia. A altura acompanha o conteúdo por medida do próprio campo, porque `field-sizing` ainda não
 * existe em todo navegador.
 */
function InlineText({
  value,
  onChange,
  label,
  as,
  variant,
  weight,
  tone,
  single = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  as: "h2" | "p";
  variant: "title2" | "callout";
  weight?: "semibold";
  tone?: "secondary";
  /** Uma linha só: `Enter` grava em vez de quebrar. */
  single?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  // Trocar de tarefa troca o valor: o rascunho acompanha, ajustado durante o render.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  const fit = (node: HTMLTextAreaElement) => {
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  };

  useEffect(() => {
    const node = field.current;
    if (!editing || !node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
    fit(node);
  }, [editing]);

  const save = () => {
    setEditing(false);
    const clean = draft.trim();
    if (clean && clean !== value) onChange(clean);
    else setDraft(value);
  };

  return (
    <Text as={as} variant={variant} weight={weight} tone={tone} className={frame.inline}>
      {editing ? (
        <textarea
          ref={field}
          className={frame.inlineField}
          value={draft}
          rows={1}
          maxLength={single ? 120 : 2000}
          aria-label={label}
          onChange={(event) => {
            setDraft(event.target.value);
            fit(event.target);
          }}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
            if (event.key === "Enter" && single) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          className={frame.inlineValue}
          aria-label={`${label}. Editar`}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setEditing(true);
            }
          }}
        >
          {value}
        </span>
      )}
    </Text>
  );
}

/** Um campo da ficha: o rótulo com o glifo em cima e o valor embaixo, que é o que abre as opções. */
function Property({ icon: Glyph, label, children, wide = false }: { icon: Icon; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cx(frame.property, wide && frame.wide)}>
      <Text as="dt" variant="footnote" tone="secondary" className={frame.propertyLabel}>
        <Glyph aria-hidden="true" />
        {label}
      </Text>
      <dd className={frame.propertyValue}>{children}</dd>
    </div>
  );
}

/* Campo sem valor diz isso em palavras, e não fica em branco: assim a pessoa sabe que ele existe e pode ser
   preenchido, em vez de achar que a ficha está quebrada. */
const Empty = () => (
  <Text as="span" variant="subheadline" className={frame.empty}>
    Vazio
  </Text>
);

function Person({ person }: { person: TaskPerson }) {
  return (
    <span className={sheet.person}>
      <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
      <Text as="span" variant="subheadline" weight="medium" truncate>
        {person.name}
      </Text>
    </span>
  );
}

/**
 * Um vínculo (2026-09-10, a pedido de "depois de colocar precisa ficar certinho"): a mídia do registro na
 * peça da casa, o nome, o identificador em **etiqueta**, e não separado por bolinha, e o desvincular na
 * ponta, dentro do mesmo container. O container é o cartão com o canto da casa; o link cobre a área toda dele
 * menos o botão, então o clique em qualquer lugar leva ao registro e só o × desvincula.
 */
function LinkRow({ link, onRemove }: { link: TaskLink; onRemove: () => void }) {
  const kind = taskLinkKinds[link.kind];

  return (
    <li className={frame.linkItem} {...squircle("md")}>
      <Link href={kind.path(link.id)} className={frame.link}>
        <RecordMediaView kind={link.kind} media={link.media} name={link.name} />
        <span className={frame.linkCopy}>
          <Text as="span" variant="subheadline" weight="medium" truncate>
            {link.name}
          </Text>
          <span className={frame.linkMeta}>
            <Badge tone="neutral" size="sm" className={frame.linkReference}>
              {link.reference}
            </Badge>
            {link.caption && (
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {link.caption}
              </Text>
            )}
          </span>
        </span>
      </Link>
      <IconButton label={`Desvincular ${link.name}`} variant="ghost" size="sm" className={frame.linkRemove} onClick={onRemove}>
        <XIcon />
      </IconButton>
    </li>
  );
}

/* Os caracteres que o `RegExp` lê como instrução: o sinal de uma marcação é texto, e precisa ser escapado
   antes de virar padrão de busca. */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Uma marcação dentro de um comentário, desenhada como o que ela aponta (2026-09-10, a pedido): pessoa vira o
 * rosto com o primeiro nome, e registro vira o glifo do domínio com o nome. É o que faz "@Marina" deixar de
 * ser texto cru e passar a ser a pessoa.
 */
function MentionChip({ mention }: { mention: TaskMention }) {
  if (mention.kind === "person") {
    return (
      <span className={frame.mentionChip} data-person>
        <Avatar name={mention.name} size="xs" />
        <Text as="span" variant="footnote" weight="medium" truncate>
          {mention.name.split(" ")[0]}
        </Text>
      </span>
    );
  }

  const kind = recordKinds[mention.kind];
  const Glyph = kind.icon;

  /* Dentro da frase vale o identificador, que é o que a pessoa escreveu: o nome inteiro do registro está no
     cartão acima da mensagem, e repeti-lo no meio do texto quebrava a linha. */
  return (
    <span className={frame.mentionChip} style={{ "--mention-hue": kind.hue } as CSSProperties} title={mention.name}>
      <Glyph weight="bold" aria-hidden="true" />
      <Text as="span" variant="footnote" weight="medium" truncate>
        {mention.reference ?? mention.name}
      </Text>
    </span>
  );
}

/**
 * O que uma marcação aponta, em cartão (2026-09-10, a pedido): a mídia do registro, o nome, o identificador em
 * etiqueta e a linha de apoio. Apontar abre o resumo do registro, na `HoverCard` da casa, e clicar leva até
 * ele. No compositor o cartão não é link e ganha o × que tira a marcação, porque ali ela ainda está sendo
 * escrita.
 *
 * É o mesmo cartão nos dois lugares de propósito: o que a pessoa monta embaixo é o que ela vai ver publicado.
 */
function MentionCard({ mention, records, onRemove }: { mention: TaskMention; records: AppRecord[]; onRemove?: () => void }) {
  const record = findRecord(records, mention);
  const kind = recordKinds[record?.kind ?? mention.kind];
  const media = record?.media ?? (mention.kind === "person" ? { kind: "face" as const, name: mention.name } : undefined);

  const body = (
    <>
      <RecordMediaView kind={record?.kind ?? mention.kind} media={media} name={mention.name} />
      <span className={frame.mentionCardCopy}>
        <Text as="span" variant="footnote" weight="semibold" truncate>
          {mention.name}
        </Text>
        <span className={frame.mentionCardMeta}>
          <Badge tone="neutral" size="sm" className={frame.mentionCardReference}>
            {mention.reference ?? record?.reference ?? kind.label}
          </Badge>
          {record?.caption && (
            <Text as="span" variant="caption2" tone="secondary" truncate>
              {record.caption}
            </Text>
          )}
        </span>
      </span>
    </>
  );

  const inner = onRemove ? (
    <span className={frame.mentionCard} data-editing>
      {body}
      <IconButton label={`Tirar a marcação de ${mention.name}`} variant="ghost" size="sm" onClick={onRemove}>
        <XIcon />
      </IconButton>
    </span>
  ) : record ? (
    <Link href={record.href} className={frame.mentionCard}>
      {body}
      <ArrowUpRightIcon className={frame.mentionCardGo} aria-hidden="true" />
    </Link>
  ) : (
    <span className={frame.mentionCard}>{body}</span>
  );

  return record ? <RecordHoverCard record={record}>{inner}</RecordHoverCard> : inner;
}

/** As marcações que merecem cartão acima da mensagem: as de registro. Pessoa fica só dentro da frase. */
const cards = (mentions?: TaskMention[]) => (mentions ?? []).filter((mention) => mention.kind !== "person");

/* De qual registro uma marcação fala: pela chave que ela guarda, e, para as que nasceram antes dela existir,
   pelo identificador ou pelo nome dentro do mesmo tipo. */
function findRecord(records: AppRecord[], mention: TaskMention) {
  if (mention.recordKey) return records.find((record) => record.key === mention.recordKey);
  /* Gente marcada é gente da casa, e ela pode estar em dois lugares: na equipe ou na base de clientes. A
     equipe vem primeiro, e quem não está lá é procurado entre os clientes, que é onde a outra metade das
     pessoas de uma tarefa mora. */
  if (mention.kind === "person") {
    return (
      records.find((record) => record.kind === "person" && record.name === mention.name) ??
      records.find((record) => record.kind === "client" && record.name === mention.name)
    );
  }
  return records.find(
    (record) => record.kind === mention.kind && (mention.reference ? record.reference === mention.reference : record.name === mention.name),
  );
}

/** O texto de um registro com as marcações viradas chip, no lugar exato em que o sinal foi escrito. */
function EventBody({ action, mentions }: { action: string; mentions?: TaskMention[] }) {
  if (!mentions || mentions.length === 0) return <>{action}</>;

  /* Do sinal mais longo para o mais curto, senão "@Ana" partiria "@Ana Clara" no meio. */
  const pattern = [...mentions]
    .sort((a, b) => b.token.length - a.token.length)
    .map((mention) => escapeRegExp(mention.token))
    .join("|");

  return (
    <>
      {action.split(new RegExp(`(${pattern})`, "g")).map((part, index) => {
        const mention = mentions.find((entry) => entry.token === part);
        return mention ? <MentionChip key={`${part}-${index}`} mention={mention} /> : part;
      })}
    </>
  );
}

/**
 * Uma parte da ficha: o nome e a contagem no cabeçalho, a ação de acrescentar na ponta direita só em glifo, e
 * o corpo com o conteúdo ou com a frase do vazio. Sem caixa: o que separa uma parte da outra é o vão da
 * coluna e o peso do nome.
 */
function Block({
  title,
  count,
  addLabel,
  onAdd,
  empty,
  children,
}: {
  title: string;
  count?: number;
  addLabel: string;
  onAdd: () => void;
  empty: string;
  children?: ReactNode;
}) {
  /* A contagem é quem sabe se o bloco tem conteúdo: `children` chega como `false` quando a condição de
     dentro não passa, e aí o estado vazio nunca aparecia. */
  const filled = count === undefined ? Boolean(children) : count > 0;

  return (
    <section className={sheet.block}>
      <div className={sheet.blockInner}>
        <div className={sheet.blockHead}>
          <span className={sheet.blockTitle}>
            <Text as="h3" variant="callout" weight="semibold">
              {title}
            </Text>
            {count !== undefined && count > 0 && (
              <Badge tone="neutral" size="sm">
                {count}
              </Badge>
            )}
          </span>
          <IconButton label={addLabel} variant="ghost" size="sm" onClick={onAdd}>
            <PlusIcon />
          </IconButton>
        </div>
        {filled ? (
          children
        ) : (
          <div className={sheet.blockEmpty}>
            <Text variant="footnote" tone="tertiary">
              {empty}
            </Text>
          </div>
        )}
      </div>
    </section>
  );
}

// A janela da tarefa, na moldura de trabalho da casa: a mesma `Dialog` `xl` do editor de orçamento, com o
// conteúdo à esquerda e a conversa numa coluna própria à direita, cada uma rolando por conta.
//
// **A ficha continua parecendo ficha** (acerto de 2026-09-10, a pedido): cada valor é desenhado como sempre
// foi, uma etiqueta, um rosto com o nome, a data por extenso, e é o clique nele que abre as opções, pelo
// gatilho sem caixa do `DropdownMenu` e pelo modo sem moldura do `DatePicker`. Título e descrição se editam
// no lugar, no mesmo tamanho e na mesma posição. Trocar o desenho por seletores, como durou uma rodada,
// fazia a ficha ler como formulário.
//
// A `key` da tarefa remonta o miolo quando outra abre: a janela é uma só para o quadro inteiro, e sem isso o
// rascunho de uma vazaria para a seguinte.
/** Quanto o dedo precisa andar na horizontal para o arrasto virar troca de página, e não rolagem torta. */
const SWIPE = 56;

/** Qual metade da ficha está à vista enquanto as duas não cabem lado a lado. */
type TaskTab = "details" | "activity";

export function TaskDialog({ task, open, onClose, stages, team, records = [], onStageChange }: TaskDialogProps) {
  /**
   * Qual metade a janela mostra enquanto as duas não cabem lado a lado. Mora **aqui**, e não no miolo, porque
   * o seletor que a troca flutua acima da bandeja, fora dela, e é a `Dialog` quem desenha esse lugar: dentro
   * da bandeja ele seria recortado pela borda dela.
   */
  const [tab, setTab] = useState<TaskTab>("details");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      label={task ? `Tarefa ${task.title}` : "Tarefa"}
      size="xl"
      focusOnOpen={false}
      above={task && <TabSwitcher tab={tab} onChange={setTab} />}
    >
      {task && (
        <TaskDetail
          key={task.id}
          task={task}
          onClose={onClose}
          stages={stages ?? defaultStages}
          team={team ?? task.people}
          records={records}
          onStageChange={onStageChange}
          tab={tab}
          onTabChange={setTab}
        />
      )}
    </Dialog>
  );
}

/**
 * O seletor entre as duas metades (2026-09-11, a pedido, sobre um print): uma peça solta **acima** da
 * bandeja, na área escura, e não dentro dela. Ele é a única coisa da janela que vive fora da caixa, porque é
 * navegação da janela inteira, e não conteúdo dela.
 *
 * O deslizante corre por trás das duas opções e é ele que dá a suavidade: uma faixa que anda em `translate`,
 * que o compositor resolve sem tocar em layout, em vez de dois fundos acendendo e apagando.
 */
function TabSwitcher({ tab, onChange }: { tab: TaskTab; onChange: (tab: TaskTab) => void }) {
  return (
    <div className={frame.switcher} role="tablist" aria-label="O que ver da tarefa">
      <span className={frame.switcherThumb} data-at={tab} aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={tab === "details"}
        className={frame.switcherOption}
        data-on={tab === "details" || undefined}
        onClick={() => onChange("details")}
      >
        Informações
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "activity"}
        className={frame.switcherOption}
        data-on={tab === "activity" || undefined}
        onClick={() => onChange("activity")}
      >
        Atividade
      </button>
    </div>
  );
}

function TaskDetail({
  task,
  onClose,
  stages,
  team,
  records,
  onStageChange,
  tab,
  onTabChange,
}: {
  task: Task;
  onClose: () => void;
  stages: TaskStage[];
  team: TaskPerson[];
  records: AppRecord[];
  onStageChange?: (stage: TaskStage) => void;
  /** Qual metade está à vista; mora na janela, porque quem a troca flutua fora da bandeja. */
  tab: TaskTab;
  onTabChange: (tab: TaskTab) => void;
}) {
  const [draft, setDraft] = useState(task);
  const [events, setEvents] = useState<TaskEvent[]>(task.activity);
  const [comment, setComment] = useState("");
  const [feed, setFeed] = useState<"all" | "comments">("all");
  /* No celular a janela é bandeja e as ações dela moram na barra flutuante, como em toda janela da casa. */
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [linking, setLinking] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [mentioning, setMentioning] = useState(false);
  const [mentions, setMentions] = useState<TaskMention[]>([]);
  /* O que está pendurado no comentário, esperando o envio: os arquivos escolhidos e o áudio gravado ali. */
  const [pending, setPending] = useState<TaskAttachment[]>([]);
  const [voice, setVoice] = useState<TaskAudio | null>(null);
  /* O microfone, aqui e não dentro do botão: no celular quem grava é a barra flutuante, e o cartão do
     comentário mostra o mesmo estado. */
  const voiceRecorder = useVoiceRecorder(setVoice);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /* O anexo da barra flutuante é um só e aceita os dois tipos: quem separa galeria de arquivos ali é o
     seletor do próprio aparelho. */
  const anyInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const patch = (change: Partial<Task>) => setDraft((current) => ({ ...current, ...change }));

  const due = dueOf(draft);
  const stage = taskStageMeta[draft.stage];
  const StageGlyph = stage.icon;
  const faces = draft.people.slice(0, SHOWN_FACES);
  const restFaces = draft.people.length - faces.length;
  const { names, rest } = peopleLabel(draft.people, 40);

  /* Quem pode assumir: a equipe mais quem já está na tarefa, sem repetir, porque o responsável em vigor
     precisa estar na lista para aparecer marcado. */
  const candidates = [draft.owner, ...draft.people, ...team].filter(
    (person, index, list) => list.findIndex((entry) => entry.name === person.name) === index,
  );

  const shownEvents = feed === "all" ? events : events.filter((event) => event.kind === "comment");

  /* A conversa na ordem em que se conversa, do mais antigo para o mais novo, e o dia marcado só quando ele
     vira: a lista guardada é do mais recente para trás, porque é assim que a atividade chega do servidor. */
  const talk = useMemo(() => {
    const ordered = [...shownEvents].reverse();
    return ordered.map((event, index) => {
      const previous = ordered[index - 1];
      const opens = !previous || previous.at.slice(0, 10) !== event.at.slice(0, 10);
      /* Mensagens seguidas da mesma pessoa, no mesmo dia, entram como um bloco só: o rosto e o nome aparecem
         na primeira e as outras só continuam, que é o que faz uma conversa longa ficar legível. */
      const opensAuthor = opens || !previous || previous.person.name !== event.person.name || previous.kind !== event.kind;
      return { event, day: opens ? dayName(event.at) : null, opensAuthor };
    });
  }, [shownEvents]);

  /* A conversa nasce no fim, junto do compositor: é lá que está a última mensagem, e é de lá que se lê para
     cima. Rola de novo a cada mensagem nova, como toda conversa. */
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = thread.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [talk.length, feed]);

  /* Os vínculos agrupados por tipo, na ordem do catálogo de vínculos: tipo sem nenhum sai do caminho. */
  const linkGroups = linkKindValues
    .map((kind) => ({ kind, items: draft.links.filter((link) => link.kind === kind) }))
    .filter((group) => group.items.length > 0);

  const stageSections: DropdownSection[] = [
    {
      id: "stage",
      label: "Etapa",
      items: stages.map((id) => {
        const meta = taskStageMeta[id];
        const Glyph = meta.icon;
        return {
          id: `stage-${id}`,
          label: meta.label,
          media: <Glyph weight="bold" style={{ color: meta.hue } as CSSProperties} />,
          selected: draft.stage === id,
          onSelect: () => {
            patch({ stage: id });
            onStageChange?.(id);
          },
        };
      }),
    },
  ];

  const ownerSections: DropdownSection[] = [
    {
      id: "owner",
      label: "Quem responde",
      items: candidates.map((person) => ({
        id: `owner-${person.name}`,
        label: person.name,
        media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
        selected: draft.owner.name === person.name,
        onSelect: () => patch({ owner: person }),
      })),
    },
  ];

  const prioritySections: DropdownSection[] = [
    {
      id: "priority",
      label: "Prioridade",
      items: priorities.map((priority) => ({
        id: `priority-${priority}`,
        label: priorityLabels[priority],
        media: priorityMark(priority),
        selected: draft.priority === priority,
        onSelect: () => patch({ priority }),
      })),
    },
  ];

  /* Os envolvidos em interruptores, porque são vários: o menu fica aberto enquanto a pessoa marca, como no
     funil de filtros das listas. */
  const peopleSections: DropdownSection[] = [
    {
      id: "people",
      label: "Quem está envolvido",
      items: candidates.map((person) => ({
        kind: "toggle" as const,
        id: `person-${person.name}`,
        label: person.name,
        media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
        checked: draft.people.some((entry) => entry.name === person.name),
        onChange: (on: boolean) =>
          patch({ people: on ? [...draft.people, person] : draft.people.filter((entry) => entry.name !== person.name) }),
      })),
    },
  ];

  /* As etiquetas por família, cada uma com a bolinha da própria cor: é escolha de uma gama pronta, e não
     texto livre, então a mesma coisa tem sempre o mesmo nome e a mesma cor em toda tarefa. */
  const tagSections: DropdownSection[] = tagGroups.map((group) => ({
    id: `tags-${group}`,
    label: group,
    items: taskTags
      .filter((tag) => tag.group === group)
      .map((tag) => ({
        kind: "toggle" as const,
        id: `tag-${tag.id}`,
        label: tag.id,
        media: tagMark(tag.id),
        checked: draft.tags.includes(tag.id),
        onChange: (on: boolean) => patch({ tags: on ? [...draft.tags, tag.id] : draft.tags.filter((entry) => entry !== tag.id) }),
      })),
  }));

  /* O que dá para anexar ao comentário: os três esperam o armazenamento de arquivo. */
  const attachSections: DropdownSection[] = [
    {
      id: "attach",
      label: "Anexar ao comentário",
      items: [
        { id: "image", label: "Imagem", icon: ImageIcon, onSelect: () => imageInput.current?.click() },
        { id: "document", label: "Documento", icon: FileTextIcon, onSelect: () => fileInput.current?.click() },
      ],
    },
  ];

  /* Marcar alguém: o leque mostra o rosto e o nome, e escolher escreve o sinal no texto e guarda a marcação,
     que é o que faz o comentário publicado desenhar a pessoa em vez do texto cru. */
  const mentionSections: DropdownSection[] = [
    {
      id: "mention",
      label: "Marcar alguém",
      items: candidates.map((person) => ({
        id: `mention-${person.name}`,
        label: person.name,
        media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
        onSelect: () => mark({ token: `@${person.name.split(" ")[0]}`, kind: "person", name: person.name }),
      })),
    },
  ];

  /**
   * Guarda a marcação e escreve o sinal dela no fim do comentário, devolvendo o foco ao campo. O texto leva o
   * sinal porque é ele que a pessoa lê enquanto escreve; a lista de marcações leva o que o sinal aponta,
   * porque é dela que o comentário publicado tira o rosto e a etiqueta.
   */
  const mark = (mention: TaskMention) => {
    setComment((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${mention.token} `);
    setMentions((current) => (current.some((entry) => entry.token === mention.token) ? current : [...current, mention]));
  };

  /* Marcar e desmarcar devolvem o foco ao campo, para quem veio do leque ou da janela continuar escrevendo
     de onde parou. Por efeito, e não dentro da ação: quem mexe no foco é o desenho, depois que ele acontece. */
  useEffect(() => {
    if (mentions.length > 0) composer.current?.focus({ preventScroll: true });
  }, [mentions.length]);

  /**
   * O que a pessoa está escrevendo depois de um "@" (2026-09-10, a pedido de "já listar as opções"): o
   * último arroba do texto, se o que vem depois dele não tem espaço, é uma busca em aberto. Nulo quer dizer
   * que não há nenhuma, e a lista não aparece.
   */
  const typing = (() => {
    const at = comment.lastIndexOf("@");
    if (at < 0) return null;
    const term = comment.slice(at + 1);
    if (/\s/.test(term)) return null;
    return { at, term };
  })();

  const suggested = typing
    ? candidates.filter((person) => slugify(person.name, 80).includes(slugify(typing.term, 80))).slice(0, 6)
    : [];

  /* Escolher da lista troca o "@par" que estava escrito pelo sinal inteiro, e guarda a marcação. */
  const complete = (person: TaskPerson) => {
    if (!typing) return;
    const token = `@${person.name.split(" ")[0]}`;
    setComment(`${comment.slice(0, typing.at)}${token} `);
    setMentions((current) => (current.some((entry) => entry.token === token) ? current : [...current, { token, kind: "person", name: person.name }]));
  };

  /* Os arquivos escolhidos entram na fila do comentário, e vão com ele no envio. */
  const take = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPending((current) => [
      ...current,
      ...Array.from(files).map((file, index) => attachmentOf(file, `comment-${Date.now()}-${current.length + index}`)),
    ]);
  };

  /** Tira a marcação e o sinal dela do texto, para as duas coisas não saírem de sincronia. */
  const unmark = (mention: TaskMention) => {
    setMentions((current) => current.filter((entry) => entry.token !== mention.token));
    setComment((current) => current.replace(mention.token, "").replace(/\s{2,}/g, " ").trimStart());
  };

  /**
   * Publicar o comentário: o texto, o que ele marcou e o que veio junto. Sai daqui e não do `onSubmit`
   * porque o Enter no campo manda pelo mesmo caminho (2026-09-10, a pedido).
   */
  /* Áudio e arquivo falam por si: uma mensagem só com eles é uma mensagem válida. A regra fica aqui porque
     o botão da barra flutuante lê a mesma coisa para saber se fica apagado. */
  const canPublish = comment.trim().length > 0 || pending.length > 0 || Boolean(voice);

  const publish = () => {
    const text = comment.trim();
    if (!canPublish) return;
    /* Só as marcações que sobraram no texto: quem apagou o sinal à mão não quer a marcação. */
    const kept = mentions.filter((mention) => text.includes(mention.token));
    setEvents((current) => [
      {
        id: `local-${current.length + 1}`,
        person: viewer,
        action: text,
        kind: "comment",
        mentions: kept.length > 0 ? kept : undefined,
        files: pending.length > 0 ? pending : undefined,
        audio: voice ?? undefined,
        at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      },
      ...current,
    ]);
    setComment("");
    setMentions([]);
    setPending([]);
    setVoice(null);
  };

  /**
   * O arrasto para o lado que vira a página (2026-09-11, a pedido), ao lado do botão da lateral: puxar para
   * a esquerda vai para a conversa e para a direita volta para a ficha, que é o sentido de quem folheia.
   *
   * A conta é feita no soltar, e não a cada movimento: o dedo precisa andar `SWIPE` na horizontal e menos que
   * isso na vertical, senão a rolagem da própria metade viraria troca de página no primeiro deslize torto.
   * Gesto que nasce num campo, num botão ou dentro de algo que rola na horizontal não conta, porque ali ele
   * é do controle, e não da janela: é o caso do campo de comentário e da fila de anexos.
   */
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

  /**
   * O que a ficha pendura na barra flutuante do celular (2026-09-11, a pedido), no contrato de toda janela
   * da casa: conteúdo na bandeja, ações na barra.
   *
   * A conta tem três degraus, e é a mesma do editor de orçamento. **Bandeja aberta por cima manda**: com o
   * seletor de registro no ar, Enviar publicaria o comentário por baixo dele, então ali a barra vira
   * concluir e fechar. (As três janelas de acrescentar cuidam disso sozinhas, porque registram as próprias
   * ações; esta é montada aqui, então a conta é aqui.)
   *
   * Na **conversa** a barra é o rodapé do compositor: enviar em glifo no fim, encostado no sair, e ao lado o
   * que se pendura na mensagem. São duas secundárias e nada mais, porque a barra é `max-content` com teto na
   * largura da tela e a quarta era cortada pelo `overflow` do grupo numa tela de 360px: anexar virou **um**
   * botão que abre o seletor do aparelho com os dois tipos, e marcar um registro saiu por ter o mesmo
   * caminho do arroba, o `#` digitado no campo.
   *
   * Nas **informações** ficam as ações da tarefa: concluir, ou reabrir no que já fechou.
   */
  const barActions: FloatingActions | null = !mobile
    ? null
    : mentioning
      ? { primary: { label: "Concluir", onClick: () => setMentioning(false) }, cancel: { label: "Fechar", onClick: () => setMentioning(false) } }
      : tab === "activity"
        ? {
            primary: {
              label: "Enviar",
              icon: <PaperPlaneTiltIcon weight="bold" />,
              iconOnly: true,
              disabled: !canPublish,
              onClick: publish,
            },
            extras: [
              { label: "Anexar ao comentário", icon: <PaperclipIcon weight="bold" />, onClick: () => anyInput.current?.click() },
              voiceRecorder.recording
                ? { label: "Encerrar a gravação", icon: <StopIcon weight="fill" />, onClick: voiceRecorder.stop }
                : { label: "Gravar áudio", icon: <MicrophoneIcon weight="bold" />, onClick: () => void voiceRecorder.start() },
            ],
            cancel: { label: "Fechar tarefa", onClick: onClose },
          }
        : {
            primary: {
              label: stage.kind === "done" ? "Reabrir" : "Concluir",
              icon: <CheckCircleIcon weight="bold" />,
              onClick: () => {
                const next: TaskStage = stage.kind === "done" ? "doing" : "done";
                patch({ stage: next });
                onStageChange?.(next);
              },
            },
            cancel: { label: "Fechar tarefa", onClick: onClose },
          };

  useFloatingActionsRegistration(barActions);

  const send = (event: FormEvent) => {
    event.preventDefault();
    publish();
  };

  return (
    <div className={frame.dialog}>
      <header className={frame.top}>
        <nav className={frame.route} aria-label="Onde a tarefa mora">
          <Link href="/tarefas" className={frame.crumb}>
            Tarefas
          </Link>
          {task.project && (
            <>
              <span className={frame.slash} aria-hidden="true">
                /
              </span>
              <Link href={`/tarefas/${task.project.slug}`} className={frame.crumb}>
                <FolderIcon aria-hidden="true" />
                {task.project.name}
              </Link>
            </>
          )}
          <Badge tone="neutral" variant="soft" size="sm" className={frame.reference}>
            {task.reference}
          </Badge>
        </nav>

        <div className={frame.actions}>
          <TaskMenu task={task} />
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div
        className={frame.body}
        data-tab={tab}
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={onSwipeCancel}
      >
        <section className={frame.main} aria-label="Informações da tarefa">
          <InlineText value={draft.title} onChange={(title) => patch({ title })} label="Título da tarefa" as="h2" variant="title2" weight="semibold" single />

          {task.alert && (
            <div className={sheet.alert} role="note" {...squircle("md", { clip: true })}>
              <WarningIcon weight="fill" aria-hidden="true" />
              <Text variant="subheadline">{task.alert}</Text>
            </div>
          )}

          <dl className={frame.properties}>
            {/* Cada valor continua desenhado como era; o clique nele é que abre as opções. */}
            <Property icon={KanbanIcon} label="Etapa">
              <DropdownMenu
                label="Etapa da tarefa"
                triggerLabel={`Etapa: ${stage.label}. Escolher outra`}
                sections={stageSections}
                triggerContent={
                  <Badge size="md" hue={stage.hue} icon={<StageGlyph />}>
                    {stage.label}
                  </Badge>
                }
              />
            </Property>

            <Property icon={UserCircleIcon} label="Responsável">
              <DropdownMenu
                label="Responsável pela tarefa"
                triggerLabel={`Responsável: ${draft.owner.name}. Escolher outro`}
                sections={ownerSections}
                triggerContent={<Person person={draft.owner} />}
              />
            </Property>

            <Property icon={FlagIcon} label="Prioridade">
              <DropdownMenu
                label="Prioridade da tarefa"
                triggerLabel={`Prioridade: ${priorityLabels[draft.priority]}. Escolher outra`}
                sections={prioritySections}
                triggerContent={
                  <Badge tone={priorityTones[draft.priority]} size="md" icon={<FlagIcon />}>
                    {priorityLabels[draft.priority]}
                  </Badge>
                }
              />
            </Property>

            <Property icon={CalendarBlankIcon} label="Prazo">
              {/* A data por extenso continua sendo o valor, e o calendário abre no clique dela. A etiqueta
                  colorida só entra quando o prazo aperta, senão as duas diriam a mesma data lado a lado. */}
              <DatePicker
                plain
                value={parseISO(draft.dueDate)}
                onChange={(date) => date && patch({ dueDate: isoDay(date) })}
                display="EEEE, d 'de' MMM."
                className={frame.plainDate}
              />
              {due.tone !== "neutral" && (
                <Badge tone={due.tone} size="md" icon={<CalendarBlankIcon />}>
                  {due.label}
                </Badge>
              )}
            </Property>

            <Property icon={CalendarBlankIcon} label="Início">
              <DatePicker
                plain
                value={draft.startDate ? parseISO(draft.startDate) : undefined}
                onChange={(date) => patch({ startDate: date ? isoDay(date) : undefined })}
                display="EEEE, d 'de' MMM."
                placeholder="Vazio"
                className={frame.plainDate}
              />
            </Property>

            <Property icon={TimerIcon} label="Estimativa">
              {/* A roleta de dias, horas e minutos da casa, sem moldura: o dia é de trabalho, oito horas,
                  que é a conta com que se estima esforço. Zero volta a ser "vazio" na ficha. */}
              <DurationPicker
                plain
                label="Estimativa de esforço"
                value={draft.estimate ?? 0}
                hoursPerDay={DAY_MINUTES / 60}
                maxDays={60}
                onChange={(minutes) => patch({ estimate: minutes === 0 ? undefined : minutes })}
                display={estimateLabel}
                placeholder="Vazio"
                className={frame.plainDate}
              />
            </Property>

            <Property icon={UsersIcon} label="Envolvidos" wide>
              <DropdownMenu
                label="Envolvidos"
                triggerLabel="Escolher quem está envolvido"
                sections={peopleSections}
                triggerContent={
                  <span className={sheet.people}>
                    {faces.length > 0 && (
                      <AvatarGroup className={sheet.faces}>
                        {faces.map((person) => (
                          <Avatar key={person.name} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
                        ))}
                      </AvatarGroup>
                    )}
                    {draft.people.length > 0 ? (
                      <Text as="span" variant="subheadline" weight="medium" truncate>
                        {names}
                        {rest > 0 && "…"}
                      </Text>
                    ) : (
                      <Empty />
                    )}
                    {restFaces > 0 && (
                      <Text as="span" variant="subheadline" tone="secondary" className={sheet.more}>
                        +{restFaces}
                      </Text>
                    )}
                  </span>
                }
              />
              <VisuallyHidden>{nameList.format(draft.people.map((person) => person.name))}</VisuallyHidden>
            </Property>

            <Property icon={TagIcon} label="Etiquetas" wide>
              <DropdownMenu
                label="Etiquetas da tarefa"
                triggerLabel="Escolher etiquetas"
                sections={tagSections}
                triggerContent={
                  draft.tags.length === 0 ? (
                    <Empty />
                  ) : (
                    <span className={frame.tagRow}>
                      {draft.tags.map((tag) => (
                        <Badge key={tag} size="md" hue={tagHue(tag)}>
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  )
                }
              />
            </Property>
          </dl>

          <hr className={sheet.rule} />

          <section className={sheet.section}>
            <div className={sheet.sectionHead}>
              <Text as="h3" variant="callout" weight="semibold">
                Descrição
              </Text>
            </div>
            <InlineText
              value={draft.description}
              onChange={(description) => patch({ description })}
              label="Descrição da tarefa"
              as="p"
              variant="callout"
              tone="secondary"
            />
          </section>

          <Block
            title="Vínculos"
            count={draft.links.length}
            addLabel="Vincular registro"
            onAdd={() => setLinking(true)}
            empty="Nenhum cliente, orçamento ou projeto vinculado."
          >
            {/* Agrupado por tipo (2026-09-10, a pedido): com cliente, orçamento e projeto na mesma pilha, o
                olho não achava o que procurava. O nome do grupo só aparece quando há mais de um tipo, senão
                seria um título para uma lista só. */}
            {linkGroups.length > 0 && (
              <div className={frame.linkGroups}>
                {linkGroups.map((group) => (
                  <div key={group.kind} className={frame.linkGroup}>
                    {linkGroups.length > 1 && (
                      <Text as="h4" variant="caption1" weight="semibold" tone="secondary" className={frame.linkGroupName}>
                        {group.items.length > 1 ? taskLinkKinds[group.kind].plural : taskLinkKinds[group.kind].label}
                      </Text>
                    )}
                    <ul className={frame.links}>
                      {group.items.map((link) => (
                        <LinkRow
                          key={`${link.kind}-${link.id}`}
                          link={link}
                          onRemove={() => patch({ links: draft.links.filter((entry) => entry !== link) })}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Block>

          <Subtasks subtasks={draft.subtasks} team={candidates} />

          <Block
            title="Anexos"
            count={draft.attachments.length}
            addLabel="Anexar arquivo"
            onAdd={() => setAttaching(true)}
            empty="Nenhum arquivo anexado."
          >
            {draft.attachments.length > 0 && (
              <ul className={sheet.list}>
                {draft.attachments.map((file) => (
                  <li key={file.id}>
                    <AttachmentCard file={file} />
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </section>

        {/* A conversa numa coluna própria: o registro de cima para baixo, o filtro no cabeçalho e o campo
            num cartão no pé, com o que dá para anexar e marcar dentro dele. */}
        <aside className={frame.side} aria-label="Atividade da tarefa">
          <div className={frame.sideHead}>
            <Text as="h3" variant="callout" weight="semibold">
              Atividade
            </Text>
            <div className={frame.switch} role="radiogroup" aria-label="O que mostrar">
              <button
                type="button"
                role="radio"
                aria-checked={feed === "all"}
                className={frame.switchOption}
                data-on={feed === "all" || undefined}
                onClick={() => setFeed("all")}
              >
                Tudo
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={feed === "comments"}
                className={frame.switchOption}
                data-on={feed === "comments" || undefined}
                onClick={() => setFeed("comments")}
              >
                Conversa
              </button>
            </div>
          </div>

          {/* A conversa (2026-09-10, a pedido): do mais antigo para o mais novo, como toda conversa, agrupada
              por dia, o comentário em bolha e a mudança de estado em linha de sistema no meio. A rolagem
              nasce embaixo, junto do compositor, que é onde a última mensagem está. */}
          <div className={frame.feed} ref={thread}>
            {shownEvents.length === 0 ? (
              <Text variant="footnote" tone="tertiary">
                {feed === "comments" ? "Nenhum comentário ainda." : "Nada registrado ainda."}
              </Text>
            ) : (
              <ol className={frame.thread}>
                {talk.map(({ event, day, opensAuthor }) => {
                  const mine = event.person.name === viewer.name;

                  return (
                    <Fragment key={event.id}>
                      {day && (
                        <li className={frame.day}>
                          <Badge tone="neutral" size="sm">
                            {day}
                          </Badge>
                        </li>
                      )}
                      {event.kind === "comment" ? (
                        <li className={frame.message} data-mine={mine || undefined} data-opens={opensAuthor || undefined}>
                          {/* O rosto só na primeira de um bloco; nas seguintes ele fica reservado, para as
                              bolhas continuarem na mesma coluna. Na minha não há rosto: numa conversa só há
                              um "eu". */}
                          {!mine && (
                            <span className={frame.face} aria-hidden={!opensAuthor || undefined}>
                              {opensAuthor && <Avatar name={event.person.name} src={event.person.avatarUrl ?? undefined} size="xs" />}
                            </span>
                          )}
                          <div className={frame.said}>
                            {opensAuthor && (
                              <span className={frame.author}>
                                <Text as="span" variant="caption1" weight="semibold">
                                  {mine ? "Você" : event.person.name.split(" ")[0]}
                                </Text>
                                <Text as="span" variant="caption2" tone="tertiary" className={frame.stamp}>
                                  {hourStamp(event.at)}
                                </Text>
                              </span>
                            )}
                            <div className={frame.bubble} {...squircle("md")}>
                              {/* O que a mensagem aponta, em cartão, acima do texto: é a ficha do registro
                                  marcado. Pessoa não entra aqui (pedido de 2026-09-10): ela já aparece por
                                  dentro da frase, com rosto e nome, e o cartão repetia o que o texto diz. */}
                              {cards(event.mentions).length > 0 && (
                                <div className={frame.bubbleCards}>
                                  {cards(event.mentions).map((mention) => (
                                    <MentionCard key={mention.token} mention={mention} records={records} />
                                  ))}
                                </div>
                              )}
                              {/* O que veio junto da mensagem: o arquivo no mesmo cartão de anexo da ficha,
                                  que já abre, baixa e mostra prévia, e o áudio no player da conversa. */}
                              {event.files && event.files.length > 0 && (
                                <div className={frame.bubbleFiles}>
                                  {event.files.map((file) => (
                                    <AttachmentCard key={file.id} file={file} />
                                  ))}
                                </div>
                              )}
                              {event.audio && <AudioBubble audio={event.audio} />}
                              {event.action && (
                                <Text as="p" variant="subheadline" className={frame.bubbleText}>
                                  <EventBody action={event.action} mentions={event.mentions} />
                                </Text>
                              )}
                            </div>
                          </div>
                        </li>
                      ) : (
                        <li className={frame.note}>
                          <Avatar name={event.person.name} src={event.person.avatarUrl ?? undefined} size="xs" />
                          <Text as="span" variant="caption1" tone="secondary" className={frame.noteText}>
                            <Text as="span" variant="caption1" weight="medium">
                              {event.person.name.split(" ")[0]}
                            </Text>{" "}
                            <EventBody action={event.action} mentions={event.mentions} />
                          </Text>
                          <Text as="span" variant="caption2" className={frame.noteStamp}>
                            {hourStamp(event.at)}
                          </Text>
                        </li>
                      )}
                    </Fragment>
                  );
                })}
              </ol>
            )}
          </div>

          {/* O cartão é o campo: o texto por dentro, sem moldura própria, e a fila de ações no pé dele. */}
          <form className={frame.composer} onSubmit={send}>
            {/* Quem cabe no "@" que está sendo escrito, numa caixa flutuante sobre o cartão, na camada e no
                desenho do menu de opções da casa (2026-09-10, a pedido): absoluta, para não empurrar o campo
                a cada tecla. O primeiro da lista responde ao Enter, como em toda conversa. */}
            {suggested.length > 0 && (
              <div className={frame.suggest} {...squircle("xl")} role="listbox" aria-label="Marcar alguém">
                {suggested.map((person) => (
                  <button key={person.name} type="button" role="option" aria-selected="false" className={frame.suggestOption} onClick={() => complete(person)}>
                    <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
                    <Text as="span" variant="subheadline" weight="medium" truncate>
                      {person.name}
                    </Text>
                  </button>
                ))}
              </div>
            )}
            <div className={frame.composerCard} {...squircle("lg")}>
              {/* O que já foi marcado, no mesmo cartão em que vai sair publicado: a mídia do registro, o
                  nome e o identificador, com o × que tira a marcação e o sinal dela do texto junto, para os
                  dois não saírem de sincronia. */}
              {cards(mentions).length > 0 && (
                <div className={frame.composerMentions}>
                  {cards(mentions).map((mention) => (
                    <MentionCard key={mention.token} mention={mention} records={records} onRemove={() => unmark(mention)} />
                  ))}
                </div>
              )}

              {/* O que vai junto com a mensagem, antes de enviar: o arquivo no cartão de anexo da casa e o
                  áudio no player, cada um com o × que o tira da fila. */}
              {(pending.length > 0 || voice) && (
                <div className={frame.composerFiles}>
                  {pending.map((file) => (
                    <span key={file.id} className={frame.composerFile}>
                      <AttachmentCard file={file} />
                      <IconButton
                        label={`Tirar ${file.name}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending((current) => current.filter((entry) => entry.id !== file.id))}
                      >
                        <XIcon />
                      </IconButton>
                    </span>
                  ))}
                  {voice && (
                    <span className={frame.composerFile}>
                      <span className={frame.composerAudio}>
                        <AudioBubble audio={voice} />
                      </span>
                      <IconButton label="Tirar o áudio" variant="ghost" size="sm" onClick={() => setVoice(null)}>
                        <XIcon />
                      </IconButton>
                    </span>
                  )}
                </div>
              )}
              <textarea
                ref={composer}
                className={frame.composerField}
                value={comment}
                rows={2}
                maxLength={COMMENT_MAX}
                placeholder="Escreva um comentário"
                aria-label="Escrever um comentário"
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  /* Com a lista do arroba aberta, Enter marca quem está na frente dela; sem ela, Enter manda
                     a mensagem, e a quebra de linha fica no Shift, como em toda conversa (2026-09-10). */
                  event.preventDefault();
                  if (suggested.length > 0) complete(suggested[0]);
                  else publish();
                }}
              />
              <div className={frame.composerBar}>
                <span className={frame.composerTools}>
                  <DropdownMenu label="Anexar" triggerLabel="Anexar ao comentário" sections={attachSections} icon={<PlusIcon />} size="sm" />
                  <DropdownMenu label="Marcar alguém" triggerLabel="Marcar alguém" sections={mentionSections} icon={<AtIcon />} size="sm" />
                  <IconButton label="Marcar um registro da aplicação" variant="ghost" size="sm" onClick={() => setMentioning(true)}>
                    <HashIcon />
                  </IconButton>
                </span>
                <span className={frame.composerSend}>
                  <VoiceButton onRecorded={setVoice} />
                  <IconButton
                    label="Comentar"
                    size="sm"
                    radius="md"
                    type="submit"
                    disabled={!comment.trim() && pending.length === 0 && !voice}
                  >
                    <PaperPlaneTiltIcon />
                  </IconButton>
                </span>
              </div>
            </div>

            {/* Dois campos de arquivo, um por tipo, porque com um só o `accept` mudado no clique chegaria
                depois de o seletor do sistema abrir. Escondidos: o desenho deles não é da casa. */}
            <input
              ref={imageInput}
              type="file"
              multiple
              accept={acceptImages}
              className={frame.picker}
              aria-label="Escolher imagens para o comentário"
              onChange={(event) => {
                take(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={acceptDocuments}
              className={frame.picker}
              aria-label="Escolher documentos para o comentário"
              onChange={(event) => {
                take(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={anyInput}
              type="file"
              multiple
              accept={acceptAny}
              className={frame.picker}
              aria-label="Escolher arquivos para o comentário"
              onChange={(event) => {
                take(event.target.files);
                event.target.value = "";
              }}
            />
          </form>
        </aside>
      </div>

      <LinkDialog
        open={linking}
        onClose={() => setLinking(false)}
        records={records}
        linked={draft.links}
        onAdd={(link) => patch({ links: [...draft.links, link] })}
      />

      <AttachmentDialog
        open={attaching}
        onClose={() => setAttaching(false)}
        onAdd={(file) => patch({ attachments: [...draft.attachments, { ...file, id: `local-${draft.attachments.length + 1}` }] })}
      />

      {/* Marcar um registro no comentário: o mesmo seletor do vincular, e o que ele devolve é escrito no
          texto com o cerquilha, que é o que o comentário guarda. */}
      <Dialog open={mentioning} onClose={() => setMentioning(false)} label="Marcar um registro" size="lg" surface="glass" focusOnOpen={false}>
        <div className={frame.mention}>
          <div className={frame.mentionHead}>
            <Text as="h2" variant="headline" weight="semibold">
              Marcar um registro
            </Text>
            <Text variant="footnote" tone="secondary">
              Tarefa, cliente, orçamento, projeto, item do catálogo ou pessoa. O identificador entra no comentário.
            </Text>
          </div>
          <RecordPicker
            records={records}
            onPick={(record) => {
              mark({
                token: `#${record.reference ?? record.name}`,
                kind: record.kind,
                name: record.name,
                reference: record.reference,
                recordKey: record.key,
              });
              setMentioning(false);
            }}
            placeholder="Buscar em toda a aplicação"
          />
        </div>
      </Dialog>
    </div>
  );
}
