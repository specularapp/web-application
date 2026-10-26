"use client";

import styled from "@emotion/styled";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CaretDownIcon,
  CheckIcon,
  CheckSquareIcon,
  EyeIcon,
  GaugeIcon,
  LockSimpleIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  RadioButtonIcon,
  SmileyIcon,
  SmileyMehIcon,
  SmileySadIcon,
  StarIcon,
  TextAlignLeftIcon,
  ThumbsUpIcon,
  TrashIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { fillSurveyText, groupLabels, groups, questionKinds, serviceLabels, services, surveyStatusLabels, surveyVariables } from "../labels";
import type { NpsGroup, Question, QuestionKind, Survey, SurveyStatus } from "../types";
import { NPS_BASE } from "./parts";
import { Segmented } from "./segmented";
import styles from "./survey-editor.module.css";
import { SurveyPreview, type SurveyPreviewScreen } from "./survey-preview";

const kindGlyphs: Record<QuestionKind, [Icon, string]> = {
  nps: [GaugeIcon, "var(--sys-blue)"],
  stars: [StarIcon, "var(--sys-yellow)"],
  choice: [RadioButtonIcon, "var(--sys-purple)"],
  multiple: [CheckSquareIcon, "var(--sys-indigo)"],
  yesNo: [ThumbsUpIcon, "var(--sys-green)"],
  text: [TextAlignLeftIcon, "var(--sys-teal)"],
};

const groupGlyphs: Record<NpsGroup, Icon> = { promoter: SmileyIcon, passive: SmileyMehIcon, detractor: SmileySadIcon };

const accents = [
  { value: "var(--sys-blue)", label: "Azul" },
  { value: "var(--sys-green)", label: "Verde" },
  { value: "var(--sys-orange)", label: "Laranja" },
  { value: "var(--sys-purple)", label: "Roxo" },
  { value: "var(--sys-pink)", label: "Rosa" },
  { value: "var(--sys-teal)", label: "Turquesa" },
  { value: "var(--sys-indigo)", label: "Índigo" },
  { value: "var(--sys-gray)", label: "Grafite" },
];

const glyph = (Glyph: Icon, color: string) => <Glyph weight="duotone" aria-hidden="true" style={{ color }} />;
const dot = (color: string) => <span className={styles.dot} style={{ "--dot": color } as CSSProperties} aria-hidden="true" />;

let questionSeed = 0;
const blank = (kind: QuestionKind): Question => {
  questionSeed += 1;
  return {
    id: `q-novo-${questionSeed}`,
    kind,
    title: { nps: "De 0 a 10, quanto você nos indicaria?", stars: "Como foi a comunicação?", choice: "Qual destas opções?", multiple: "O que mais ajudou?", yesNo: "Contrataria a gente de novo?", text: "Quer contar mais?" }[kind],
    help: "",
    required: kind === "nps",
    options: kind === "choice" || kind === "multiple" ? ["Opção 1", "Opção 2"] : [],
    aspect: kind === "stars" ? "Comunicação" : "",
    showTo: [],
  };
};

/** O que a gravação recusaria, dito na língua de quem edita. */
function surveyProblem(survey: Survey) {
  if (survey.name.trim().length < 3) return "Dê um nome de pelo menos 3 letras à pesquisa.";
  if (survey.services.length === 0) return "Escolha pelo menos um tipo de projeto.";
  if (!survey.questions.some((question) => question.kind === "nps")) return "A pesquisa precisa da nota de 0 a 10.";
  for (const question of survey.questions) {
    if (!question.title.trim()) return "Toda pergunta precisa de um enunciado.";
    if (question.kind === "stars" && !question.aspect.trim()) return `Diga o aspecto que “${question.title.trim()}” mede.`;
    const options = question.options.map((option) => option.trim());
    if ((question.kind === "choice" || question.kind === "multiple") && (options.length < 2 || options.some((option) => !option) || new Set(options).size !== options.length)) return `Dê pelo menos duas alternativas diferentes em “${question.title.trim()}”.`;
  }
  for (const group of groups) if (!survey.thanks[group].title.trim()) return `Escreva o título do agradecimento dos ${groupLabels[group].plural.toLowerCase()}.`;
  return null;
}

/** Insere a variável onde está o cursor do campo e devolve o foco logo depois dela. */
function insertAt(field: HTMLInputElement | HTMLTextAreaElement | null, current: string, token: string, onChange: (value: string) => void) {
  const start = field?.selectionStart ?? current.length;
  const end = field?.selectionEnd ?? current.length;
  const before = current.slice(0, start);
  const spaced = before && !/\s$/.test(before) ? ` ${token}` : token;
  onChange(before + spaced + current.slice(end));
  requestAnimationFrame(() => {
    field?.focus();
    const caret = start + spaced.length;
    field?.setSelectionRange(caret, caret);
  });
}

const QuestionToggle = styled.button`
  display: flex;
  flex: 1;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  min-height: var(--control-height-md);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-subheadline);
  color: var(--color-label);
  text-align: start;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-md);

  &:hover {
    background-color: var(--color-fill-quaternary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  & > svg:last-of-type {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--color-label-tertiary);
    transition: transform var(--duration-fast) var(--ease-standard);
  }

  &[aria-expanded="true"] > svg:last-of-type {
    transform: rotate(180deg);
  }

  @media (pointer: coarse) {
    min-height: var(--touch-target);
  }

  @media (prefers-reduced-motion: reduce) {
    & > svg:last-of-type {
      transition: none;
    }
  }
`;

const VariableButton = styled.button`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  min-height: 1.75rem;
  padding: 0 var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  color: var(--color-label-secondary);
  cursor: pointer;
  background-color: var(--color-fill-quaternary);
  border: 0.0375rem solid var(--color-border);
  border-radius: var(--radius-sm);

  & code {
    font-family: var(--font-code);
    font-weight: var(--weight-semibold);
    color: var(--color-label);
  }

  &:hover {
    background-color: var(--color-fill-tertiary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: var(--touch-target);
  }
`;

const SAMPLE = { name: "Helena Prado", project: "Rebranding Atelier Prado" };

function VariableBar({ field, value, onChange, preview = true }: { field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>; value: string; onChange: (value: string) => void; preview?: boolean }) {
  const used = surveyVariables.some((variable) => value.includes(variable.token));
  return (
    <div className={styles.variables}>
      <div className={styles.variableRow}>
        <span className={styles.variableLabel}>Inserir</span>
        {surveyVariables.map((variable) => (
          <Tooltip key={variable.token} content={`Vira, por exemplo, ${variable.example}`}>
            <VariableButton type="button" onClick={() => insertAt(field.current, value, variable.token, onChange)}>
              <code>{variable.token}</code>
              {variable.label}
            </VariableButton>
          </Tooltip>
        ))}
      </div>
      {preview && used && (
        <p className={styles.variablePreview}>
          <span>Fica assim:</span> {fillSurveyText(value, SAMPLE)}
        </p>
      )}
    </div>
  );
}

function Section({ number, title, caption, children }: { number: number; title: string; caption: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <header className={styles.sectionHead}>
        <span className={styles.number} aria-hidden="true">
          {number}
        </span>
        <span>
          <Text as="h3" id={id} variant="subheadline" weight="semibold">
            {title}
          </Text>
          <Text as="span" variant="caption1" tone="secondary">
            {caption}
          </Text>
        </span>
      </header>
      <div className={styles.fields}>{children}</div>
    </section>
  );
}

type QuestionCardProps = {
  question: Question;
  number: number;
  open: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Question>) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
};

function QuestionCard({ question, number, open, first, last, onToggle, onChange, onMove, onRemove }: QuestionCardProps) {
  const bodyId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const locked = question.kind === "nps";
  const [KindGlyph, kindColor] = kindGlyphs[question.kind];
  const choice = question.kind === "choice" || question.kind === "multiple";
  const kinds = (Object.keys(questionKinds) as QuestionKind[]).filter((kind) => kind !== "nps").map((kind) => ({ value: kind, label: questionKinds[kind].label, caption: questionKinds[kind].description, media: glyph(...kindGlyphs[kind]) }));

  const changeKind = (kind: QuestionKind) => {
    const nextChoice = kind === "choice" || kind === "multiple";
    onChange({ kind, options: nextChoice ? (question.options.length > 0 ? question.options : ["Opção 1", "Opção 2"]) : [], aspect: kind === "stars" ? question.aspect || "Comunicação" : "" });
  };

  return (
    <article className={styles.question} data-open={open || undefined}>
      <header className={styles.questionHead}>
        <span className={styles.questionNumber}>{number}</span>
        <QuestionToggle type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <KindGlyph weight="duotone" aria-label={questionKinds[question.kind].label} style={{ color: kindColor, flexShrink: 0 }} />
          <span className={styles.questionLabel}>
            {question.title || "Pergunta sem enunciado"}
            {question.required && <span className={styles.required}> *</span>}
          </span>
          {question.showTo.length > 0 && (
            <Badge tone="neutral" size="sm">
              Só {question.showTo.map((group) => groupLabels[group].plural.toLowerCase()).join(" e ")}
            </Badge>
          )}
          <CaretDownIcon aria-hidden="true" />
        </QuestionToggle>
        {locked ? (
          <Tooltip content="A nota abre a pesquisa e não sai do lugar">
            <span className={styles.lock} role="img" aria-label="Pergunta fixa">
              <LockSimpleIcon />
            </span>
          </Tooltip>
        ) : (
          <span className={styles.questionTools}>
            <IconButton label={`Subir a pergunta ${number}`} variant="ghost" size="sm" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUpIcon />
            </IconButton>
            <IconButton label={`Descer a pergunta ${number}`} variant="ghost" size="sm" disabled={last} onClick={() => onMove(1)}>
              <ArrowDownIcon />
            </IconButton>
            <IconButton label={`Remover a pergunta ${number}`} variant="ghost" size="sm" onClick={onRemove}>
              <TrashIcon />
            </IconButton>
          </span>
        )}
      </header>

      {open && (
        <div className={styles.questionBody} id={bodyId}>
          <Field label="Pergunta" required>
            <Input ref={titleRef} size="sm" value={question.title} maxLength={180} onChange={(event) => onChange({ title: event.target.value })} />
          </Field>
          <VariableBar field={titleRef} value={question.title} onChange={(title) => onChange({ title })} preview={false} />
          <div className={styles.grid2}>
            {!locked && (
              <Field label="Tipo">
                <Select size="sm" label="Tipo" value={question.kind} options={kinds} onChange={changeKind} />
              </Field>
            )}
            {question.kind === "stars" && (
              <Field label="Aspecto medido" required>
                <Input size="sm" value={question.aspect} maxLength={40} placeholder="Comunicação, Prazo" onChange={(event) => onChange({ aspect: event.target.value })} />
              </Field>
            )}
          </div>
          <Field label="Explicação opcional">
            <Input size="sm" value={question.help} maxLength={140} placeholder="Aparece embaixo da pergunta" onChange={(event) => onChange({ help: event.target.value })} />
          </Field>
          {choice && (
            <fieldset className={styles.optionList}>
              <legend>Alternativas</legend>
              {question.options.map((option, index) => (
                <span key={index} className={styles.optionRow}>
                  <Input size="sm" aria-label={`Alternativa ${index + 1}`} value={option} maxLength={80} onChange={(event) => onChange({ options: question.options.map((item, position) => (position === index ? event.target.value : item)) })} />
                  <IconButton label={`Remover a alternativa ${index + 1}`} variant="ghost" size="sm" disabled={question.options.length <= 2} onClick={() => onChange({ options: question.options.filter((_, position) => position !== index) })}>
                    <XIcon />
                  </IconButton>
                </span>
              ))}
              <span>
                <Button variant="ghost" size="sm" radius="md" iconStart={<PlusIcon />} disabled={question.options.length >= 8} onClick={() => onChange({ options: [...question.options, `Opção ${question.options.length + 1}`] })}>
                  Alternativa
                </Button>
              </span>
            </fieldset>
          )}
          {!locked && (
            <>
              <fieldset className={styles.checks}>
                <legend>Para quem aparece</legend>
                {groups.map((group) => (
                  <Checkbox key={group} checked={question.showTo.includes(group)} onChange={(event) => onChange({ showTo: event.target.checked ? [...question.showTo, group] : question.showTo.filter((item) => item !== group) })}>
                    {groupLabels[group].plural} ({groupLabels[group].range})
                  </Checkbox>
                ))}
              </fieldset>
              <Text variant="caption1" tone="secondary">
                Nenhuma faixa marcada: aparece para todos. Marcada: só depois de uma nota daquela faixa.
              </Text>
              <Switch size="sm" checked={question.required} onChange={(event) => onChange({ required: event.target.checked })}>
                Resposta obrigatória
              </Switch>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * O editor da pesquisa em tela inteira, com a prévia ao lado, na moldura dos editores da casa: a barra com o
 * voltar, o nome, a situação e as ações; à esquerda as seções numeradas (identificação, apresentação,
 * perguntas, como chega e agradecimento); à direita a página pública num aparelho, respondível. No celular,
 * dados e prévia viram duas abas e as ações vão para a barra flutuante.
 */
export function SurveyEditor({ survey: initial }: { survey: Survey }) {
  const router = useRouter();
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [survey, setSurvey] = useState(initial);
  const [tab, setTab] = useState<"form" | "preview">("form");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [thanksGroup, setThanksGroup] = useState<NpsGroup>("promoter");
  const [screen, setScreen] = useState<SurveyPreviewScreen>("form");
  const introRef = useRef<HTMLTextAreaElement>(null);
  const thanksRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  const set = <K extends keyof Survey>(key: K, value: Survey[K]) => setSurvey((current) => ({ ...current, [key]: value }));
  const updateQuestion = (id: string, patch: Partial<Question>) => setSurvey((current) => ({ ...current, questions: current.questions.map((question) => (question.id === id ? { ...question, ...patch } : question)) }));
  const removeQuestion = (id: string) => setSurvey((current) => ({ ...current, questions: current.questions.filter((question) => question.id !== id) }));
  const moveQuestion = (id: string, step: -1 | 1) =>
    setSurvey((current) => {
      const from = current.questions.findIndex((question) => question.id === id);
      const to = from + step;
      if (from < 0 || to < 0 || to >= current.questions.length || current.questions[to].kind === "nps") return current;
      const questions = [...current.questions];
      [questions[from], questions[to]] = [questions[to], questions[from]];
      return { ...current, questions };
    });
  const addQuestion = (kind: QuestionKind) => {
    const question = blank(kind);
    setSurvey((current) => ({ ...current, questions: kind === "nps" ? [question, ...current.questions] : [...current.questions, question] }));
    setOpenQuestion(question.id);
  };
  const hasNps = survey.questions.some((question) => question.kind === "nps");
  const leave = () => router.push(`${NPS_BASE}/pesquisas` as Route);

  const save = () => {
    const problem = surveyProblem(survey);
    if (problem) return toast({ title: "Ainda não dá para salvar", description: problem, tone: "warning" });
    toast({ title: "Pesquisa conferida", description: "Está tudo certo. A gravação entra junto com o banco do NPS.", tone: "success", feedback: false });
  };
  const changeStatus = (status: SurveyStatus) => {
    const problem = status === "active" ? surveyProblem(survey) : null;
    if (problem) return toast({ title: "Ainda não dá para ativar", description: problem, tone: "warning" });
    set("status", status);
    toast({ title: status === "active" ? "Pesquisa ativa" : "Pesquisa pausada", description: status === "active" ? "Os links passam a aceitar respostas." : "Os links param de aceitar respostas até reativar.", tone: "success", feedback: false });
  };
  const setThanks = (field: "title" | "text", value: string) => set("thanks", { ...survey.thanks, [thanksGroup]: { ...survey.thanks[thanksGroup], [field]: value } });
  const focusThanks = (group: NpsGroup) => {
    setThanksGroup(group);
    setScreen(group);
  };

  useFloatingActionsRegistration(mobile ? { primary: { label: "Salvar", onClick: save }, cancel: { label: "Sair", onClick: leave } } : null);

  const showForm = !mobile || tab === "form";
  const showPreview = !mobile || tab === "preview";
  const status = surveyStatusLabels[survey.status];

  return (
    <div className={styles.editor}>
      <header className={styles.head}>
        <IconButton label="Voltar para as pesquisas" variant="ghost" size="sm" href={`${NPS_BASE}/pesquisas`}>
          <ArrowLeftIcon />
        </IconButton>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold" truncate>
            {survey.name.trim() || "Nova pesquisa"}
          </Text>
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </div>
        {mobile ? (
          <Segmented
            label="Dados ou prévia"
            value={tab}
            onChange={setTab}
            options={[
              { value: "form", label: "Dados", icon: <PencilSimpleIcon aria-hidden="true" /> },
              { value: "preview", label: "Prévia", icon: <EyeIcon aria-hidden="true" /> },
            ]}
          />
        ) : (
          <div className={styles.actions}>
            {survey.status === "active" ? (
              <Button variant="outline" size="sm" radius="md" iconStart={<PauseIcon />} onClick={() => changeStatus("paused")}>
                Pausar
              </Button>
            ) : (
              survey.status !== "archived" && (
                <Button variant="outline" size="sm" radius="md" iconStart={<PlayIcon />} onClick={() => changeStatus("active")}>
                  Ativar
                </Button>
              )
            )}
            <Button size="sm" radius="md" iconStart={<CheckIcon />} onClick={save}>
              Salvar
            </Button>
          </div>
        )}
      </header>

      <div className={styles.body} data-form={showForm || undefined} data-preview={showPreview || undefined}>
        {showForm && (
          <div className={styles.form} aria-labelledby={titleId}>
            <Section number={1} title="Identificação" caption="O nome, para quais projetos e a cor.">
              <Field label="Nome da pesquisa" required>
                <Input value={survey.name} maxLength={60} onChange={(event) => set("name", event.target.value)} />
              </Field>
              <Field label="Cor de destaque">
                <Select label="Cor de destaque" value={survey.accent} options={accents.map((accent) => ({ value: accent.value, label: accent.label, media: dot(accent.value) }))} onChange={(accent) => set("accent", accent)} />
              </Field>
              <fieldset className={styles.checks}>
                <legend>Tipos de projeto</legend>
                {services.map((service) => (
                  <Checkbox key={service} checked={survey.services.includes(service)} onChange={(event) => set("services", event.target.checked ? [...survey.services, service] : survey.services.filter((item) => item !== service))}>
                    {serviceLabels[service].label}
                  </Checkbox>
                ))}
              </fieldset>
              {mobile && survey.status !== "archived" && (
                <Switch checked={survey.status === "active"} onChange={(event) => changeStatus(event.target.checked ? "active" : "paused")}>
                  Pesquisa no ar
                </Switch>
              )}
            </Section>

            <Section number={2} title="Apresentação" caption="O que o cliente lê ao abrir.">
              <Field label="Saudação do topo">
                <Textarea ref={introRef} rows={3} value={survey.intro} maxLength={240} onChange={(event) => set("intro", event.target.value)} onFocus={() => setScreen("form")} />
              </Field>
              <VariableBar field={introRef} value={survey.intro} onChange={(intro) => set("intro", intro)} />
            </Section>

            <Section number={3} title="Perguntas" caption="Na ordem em que o cliente responde.">
              <div className={styles.questions}>
                {survey.questions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    number={index + 1}
                    open={openQuestion === question.id}
                    first={index === 0 || survey.questions[index - 1]?.kind === "nps"}
                    last={index === survey.questions.length - 1}
                    onToggle={() => {
                      setOpenQuestion((current) => (current === question.id ? null : question.id));
                      setScreen("form");
                    }}
                    onChange={(patch) => updateQuestion(question.id, patch)}
                    onMove={(step) => moveQuestion(question.id, step)}
                    onRemove={() => removeQuestion(question.id)}
                  />
                ))}
              </div>
              {survey.questions.length === 0 && (
                <Text variant="footnote" tone="secondary">
                  Nenhuma pergunta ainda. Comece pela nota de 0 a 10.
                </Text>
              )}
              <span>
                <DropdownMenu
                  label="Adicionar pergunta"
                  triggerLabel="Adicionar pergunta"
                  searchable={false}
                  trigger={{ variant: "outline", radius: "md" }}
                  icon={<PlusIcon />}
                  sections={[
                    {
                      id: "kinds",
                      label: "Tipo da pergunta",
                      items: (Object.keys(questionKinds) as QuestionKind[])
                        .filter((kind) => kind !== "nps" || !hasNps)
                        .map((kind) => ({ id: kind, label: questionKinds[kind].label, media: glyph(...kindGlyphs[kind]), onSelect: () => addQuestion(kind) })),
                    },
                  ]}
                />
              </span>
              <Text variant="caption1" tone="secondary">
                A nota de 0 a 10 abre a pesquisa: é ela que dá o NPS e decide o que cada faixa vê depois. Nota de 0 a 6 abre uma tratativa na hora.
              </Text>
            </Section>

            <Section number={4} title="Como chega" caption="Os caminhos até o cliente.">
              <Switch checked={survey.publicLink} onChange={(event) => set("publicLink", event.target.checked)}>
                <span className={styles.switchText}>
                  Link aberto
                  <small>Aceita resposta sem envio individual, como um link na assinatura do e-mail.</small>
                </span>
              </Switch>
              <Switch checked={survey.testimonial} onChange={(event) => set("testimonial", event.target.checked)}>
                <span className={styles.switchText}>
                  Convidar promotores para um depoimento
                  <small>Quem dá 9 ou 10 vê o botão de deixar um depoimento para o portfólio.</small>
                </span>
              </Switch>
            </Section>

            <Section number={5} title="Agradecimento" caption="A tela depois de enviar, por faixa.">
              <Field label="Faixa">
                <Select label="Faixa do agradecimento" value={thanksGroup} options={groups.map((group) => ({ value: group, label: `${groupLabels[group].plural}, notas ${groupLabels[group].range}`, media: glyph(groupGlyphs[group], groupLabels[group].color) }))} onChange={focusThanks} />
              </Field>
              <Field label="Título" required>
                <Input value={survey.thanks[thanksGroup].title} maxLength={80} onFocus={() => setScreen(thanksGroup)} onChange={(event) => setThanks("title", event.target.value)} />
              </Field>
              <Field label="Mensagem">
                <Textarea ref={thanksRef} rows={3} value={survey.thanks[thanksGroup].text} maxLength={320} onFocus={() => setScreen(thanksGroup)} onChange={(event) => setThanks("text", event.target.value)} />
              </Field>
              <VariableBar field={thanksRef} value={survey.thanks[thanksGroup].text} onChange={(text) => setThanks("text", text)} />
              <Text variant="caption1" tone="secondary">
                {thanksGroup === "promoter" ? (survey.testimonial ? "Embaixo vai o botão de deixar um depoimento." : "Ligue o convite de depoimento na seção 4 para o promotor ver o botão.") : thanksGroup === "detractor" ? "Embaixo vai o atalho de falar pelo WhatsApp." : "Responda a prévia com 7 ou 8 para ver esta tela."}
              </Text>
            </Section>
          </div>
        )}

        {showPreview && (
          <aside className={styles.preview} aria-label="Prévia da pesquisa">
            <div className={styles.previewHead}>
              <Text as="h3" variant="caption1" weight="semibold" tone="secondary">
                Como o cliente vê
              </Text>
              <Segmented<SurveyPreviewScreen>
                as="radio"
                label="Tela da prévia"
                value={screen}
                onChange={setScreen}
                options={[
                  { value: "form", label: "Pesquisa" },
                  ...groups.map((group) => ({ value: group, label: groupLabels[group].plural })),
                ]}
              />
            </div>
            <SurveyPreview survey={survey} screen={screen} onScreen={setScreen} />
          </aside>
        )}
      </div>
    </div>
  );
}
