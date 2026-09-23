"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopySimpleIcon,
  DotsSixVerticalIcon,
  EnvelopeSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type CSSProperties } from "react";
import { Topbar } from "@/components/layout/topbar";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AiUsage } from "@/features/ai/summary";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { callAction } from "@/lib/action";
import { saveIntakeFormAction } from "../actions";
import { profileFieldOptions, questionTypeOptions } from "../labels";
import { intakeFormUrl } from "../share";
import type { IntakeForm, IntakeFormClient, IntakeFormProject, IntakeProfileField, IntakeQuestion, IntakeQuestionType } from "../summary";
import styles from "./form-editor-screen.module.css";

type Draft = {
  projectId: string;
  clientId: string | null;
  title: string;
  description: string;
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  consentText: string;
  expiresAt: string;
  questions: IntakeQuestion[];
};

const day = (iso: string) => iso.slice(0, 10);
const futureDay = () => {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().slice(0, 10);
};
const defaultQuestions = (): IntakeQuestion[] => [
  { id: crypto.randomUUID(), type: "short_text", profileField: "name", label: "Qual é o seu nome?", description: "", placeholder: "Nome completo", required: true, options: [], page: 0, position: 0 },
  { id: crypto.randomUUID(), type: "email", profileField: "email", label: "Qual é o seu melhor e-mail?", description: "", placeholder: "voce@empresa.com", required: true, options: [], page: 1, position: 1 },
  { id: crypto.randomUUID(), type: "phone", profileField: "phone", label: "Qual é o seu telefone?", description: "", placeholder: "(11) 99999-9999", required: false, options: [], page: 2, position: 2 },
];

function initialDraft(form: IntakeForm | null, projects: IntakeFormProject[]): Draft {
  return form
    ? {
        projectId: form.project.id,
        clientId: form.client?.id ?? null,
        title: form.title,
        description: form.description,
        submitLabel: form.submitLabel,
        successTitle: form.successTitle,
        successMessage: form.successMessage,
        consentText: form.consentText,
        expiresAt: day(form.expiresAt),
        questions: form.questions,
      }
    : {
        projectId: projects[0]?.id ?? "",
        clientId: null,
        title: "Informações para começar o projeto",
        description: "Conte o que precisamos saber para organizar as próximas etapas.",
        submitLabel: "Enviar respostas",
        successTitle: "Respostas enviadas",
        successMessage: "Recebemos suas informações. A equipe já pode continuar o projeto.",
        consentText: "Concordo com o uso destas informações para cadastro, contato e execução do projeto.",
        expiresAt: futureDay(),
        questions: defaultQuestions(),
      };
}

export function FormEditorScreen({ form, projects, clients, ai }: { form: IntakeForm | null; projects: IntakeFormProject[]; clients: IntakeFormClient[]; ai: AiUsage }) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => initialDraft(form, projects));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const project = projects.find((entry) => entry.id === draft.projectId) ?? projects[0] ?? null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateQuestion = (id: string, values: Partial<IntakeQuestion>) => set("questions", draft.questions.map((question) => question.id === id ? { ...question, ...values } : question));
  const addQuestion = () => set("questions", [...draft.questions, { id: crypto.randomUUID(), type: "short_text", profileField: null, label: "Nova pergunta", description: "", placeholder: "", required: false, options: [], page: Math.max(-1, ...draft.questions.map((question) => question.page)) + 1, position: draft.questions.length }]);
  const removeQuestion = (id: string) => set("questions", draft.questions.filter((question) => question.id !== id));
  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = draft.questions.findIndex((question) => question.id === active.id);
    const to = draft.questions.findIndex((question) => question.id === over.id);
    if (from >= 0 && to >= 0) set("questions", arrayMove(draft.questions, from, to));
  };

  const save = async (status: "draft" | "published") => {
    if (!draft.projectId || saving) return;
    setSaving(true);
    setError(null);
    const result = await callAction(saveIntakeFormAction({
      id: form?.id,
      ...draft,
      status,
      clientId: draft.clientId,
      expiresAt: new Date(`${draft.expiresAt}T23:59:59-03:00`).toISOString(),
      questions: draft.questions.map(({ position: _position, ...question }) => question),
    }));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      toast({ title: "Não deu para salvar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: status === "published" ? "Formulário publicado" : "Rascunho salvo", description: status === "published" ? "O link já pode ser enviado ao cliente." : "Você pode continuar a edição depois.", tone: "success" });
    if (status === "published") await navigator.clipboard.writeText(intakeFormUrl(result.token)).catch(() => undefined);
    router.push(`/formularios/${result.id}` as Route);
  };

  const copy = async () => {
    if (!form || form.status !== "published") return;
    await navigator.clipboard.writeText(intakeFormUrl(form.shareToken));
    toast({ title: "Link copiado", description: "Pronto para enviar ao cliente.", tone: "success" });
  };

  const projectOptions = projects.map((entry) => ({ value: entry.id, label: entry.name, caption: entry.reference, media: <ProjectMark project={{ ...entry, hue: entry.hue as never }} size="sm" /> }));
  const clientOptions = [{ value: "none", label: "Qualquer cliente" }, ...clients.map((client) => ({ value: client.id, label: client.name, caption: client.email ?? undefined, media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" /> }))];

  return (
    <div className={styles.screen}>
      <Topbar title={form ? "Editar formulário" : "Novo formulário"} ai={ai} />
      <header className={styles.actions}>
        <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowLeftIcon />} onClick={() => router.push("/formularios")}>Formulários</Button>
        <div className={styles.actionEnd}>
          <span className={styles.mobileActions}>
            <DropdownMenu
              label="Ações do formulário"
              triggerLabel="Abrir ações do formulário"
              size="sm"
              sections={[{
                id: "form",
                items: [
                  ...(form?.status === "published" ? [{ id: "copy", label: "Copiar link", icon: CopySimpleIcon, onSelect: () => void copy() }] : []),
                  ...(form ? [{ id: "responses", label: "Ver respostas", icon: UsersThreeIcon, href: `/formularios/${form.id}/respostas` as Route }] : []),
                  { id: "draft", label: "Salvar rascunho", icon: CheckIcon, onSelect: () => void save("draft") },
                ],
              }]}
            />
          </span>
          {form?.status === "published" && <Button variant="outline" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy()}>Copiar link</Button>}
          {form && <Button href={`/formularios/${form.id}/respostas` as Route} variant="outline" size="sm" radius="md" iconStart={<UsersThreeIcon />}>Respostas</Button>}
          <Button variant="outline" size="sm" radius="md" loading={saving} onClick={() => void save("draft")}>Salvar rascunho</Button>
          <Button size="sm" radius="md" loading={saving} iconStart={<CheckIcon />} onClick={() => void save("published")}>
            <span className={styles.desktopPublish}>{form?.status === "published" ? "Salvar e publicar" : "Publicar"}</span>
            <span className={styles.mobilePublish}>Publicar</span>
          </Button>
        </div>
      </header>

      <div className={styles.workspace}>
        <div className={styles.builder}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><span>1</span><div><h2>Identidade e destino</h2><p>O projeto define a marca, a cor e o contexto que o cliente verá.</p></div></div>
            <div className={styles.twoColumns}>
              <Field label="Projeto" required><Select label="Projeto" value={draft.projectId} options={projectOptions} searchable onChange={(value) => set("projectId", String(value))} /></Field>
              <Field label="Cliente específico"><Select label="Cliente específico" value={draft.clientId ?? "none"} options={clientOptions} searchable onChange={(value) => set("clientId", value === "none" ? null : String(value))} /></Field>
            </div>
            <Field label="Título" required><Input value={draft.title} maxLength={120} onChange={(event) => set("title", event.target.value)} /></Field>
            <Field label="Introdução"><Textarea value={draft.description} rows={3} maxLength={1200} onChange={(event) => set("description", event.target.value)} /></Field>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}><span>2</span><div><h2>Perguntas</h2><p>Arraste para ordenar, escolha a página e reúna perguntas relacionadas quando fizer sentido.</p></div></div>
            <DndContext id={dragId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={reorder}>
              <SortableContext items={draft.questions.map((question) => question.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.questions}>
                  {draft.questions.map((question, index) => (
                    <SortableQuestion key={question.id} question={question} index={index} all={draft.questions} onChange={(values) => updateQuestion(question.id, values)} onRemove={() => removeQuestion(question.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button type="button" variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} onClick={addQuestion}>Adicionar pergunta</Button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}><span>3</span><div><h2>Envio e consentimento</h2><p>Defina a validade, a confirmação e o texto que será guardado junto da resposta.</p></div></div>
            <div className={styles.twoColumns}>
              <Field label="Texto do botão" required><Input value={draft.submitLabel} maxLength={40} onChange={(event) => set("submitLabel", event.target.value)} /></Field>
              <Field label="Link válido até" required><Input type="date" value={draft.expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(event) => set("expiresAt", event.target.value)} /></Field>
            </div>
            <div className={styles.twoColumns}>
              <Field label="Título após o envio" required><Input value={draft.successTitle} maxLength={80} onChange={(event) => set("successTitle", event.target.value)} /></Field>
              <Field label="Mensagem após o envio" required><Input value={draft.successMessage} maxLength={500} onChange={(event) => set("successMessage", event.target.value)} /></Field>
            </div>
            <Field label="Consentimento obrigatório" required><Textarea value={draft.consentText} rows={3} maxLength={1000} onChange={(event) => set("consentText", event.target.value)} /></Field>
          </section>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        <aside className={styles.preview}>
          <div className={styles.previewLabel}><span>Prévia do cliente</span><Badge tone="neutral" size="sm">Responsiva</Badge></div>
          <FormPreview draft={draft} project={project} />
        </aside>
      </div>
    </div>
  );
}

function SortableQuestion({ question, index, all, onChange, onRemove }: { question: IntakeQuestion; index: number; all: IntakeQuestion[]; onChange: (values: Partial<IntakeQuestion>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const choice = question.type === "single_choice" || question.type === "multiple_choice";
  const used = new Set(all.filter((entry) => entry.id !== question.id).map((entry) => entry.profileField).filter(Boolean));
  const mappings = profileFieldOptions.filter((option) => option.value === "none" || option.value === question.profileField || !used.has(option.value as IntakeProfileField));
  const lastPage = Math.max(0, ...all.map((entry) => entry.page));
  const pageOptions = Array.from({ length: lastPage + 2 }, (_, page) => ({ value: page, label: page === lastPage + 1 ? `Nova página ${page + 1}` : `Página ${page + 1}` }));

  const map = (value: string) => {
    const profileField = value === "none" ? null : value as IntakeProfileField;
    const type = profileField === "email" ? "email" : profileField === "phone" ? "phone" : question.type;
    onChange({ profileField, type });
  };

  return (
    <article ref={setNodeRef} className={styles.question} data-dragging={isDragging || undefined} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <header className={styles.questionHead}>
        <button ref={setActivatorNodeRef} type="button" className={styles.drag} aria-label={`Mover pergunta ${index + 1}`} {...attributes} {...listeners}><DotsSixVerticalIcon /></button>
        <strong>Pergunta {index + 1}</strong>
        <Badge tone="neutral" size="sm">Página {question.page + 1}</Badge>
        <IconButton label={`Remover pergunta ${index + 1}`} size="sm" variant="ghost" onClick={onRemove}><TrashIcon /></IconButton>
      </header>
      <div className={styles.questionGrid}>
        <Field label="Pergunta" required><Input value={question.label} maxLength={160} onChange={(event) => onChange({ label: event.target.value })} /></Field>
        <Field label="Tipo"><Select label="Tipo" value={question.type} options={questionTypeOptions} onChange={(value) => onChange({ type: value as IntakeQuestionType, options: ["single_choice", "multiple_choice"].includes(String(value)) ? question.options : [] })} /></Field>
        <Field label="Página"><Select label="Página" value={question.page} options={pageOptions} onChange={(value) => onChange({ page: Number(value) })} /></Field>
        <Field label="Atualiza o cadastro"><Select label="Atualiza o cadastro" value={question.profileField ?? "none"} options={mappings} onChange={(value) => map(String(value))} /></Field>
        <Field label="Texto de exemplo"><Input value={question.placeholder} maxLength={120} onChange={(event) => onChange({ placeholder: event.target.value })} /></Field>
      </div>
      <Field label="Explicação opcional"><Input value={question.description} maxLength={500} onChange={(event) => onChange({ description: event.target.value })} /></Field>
      {choice && <Field label="Opções separadas por vírgula" required><Textarea rows={2} value={question.options.join(", ")} onChange={(event) => onChange({ options: event.target.value.split(/,|\n/).map((value) => value.trim()).filter(Boolean) })} /></Field>}
      <Checkbox checked={question.required} onChange={(event) => onChange({ required: event.target.checked })}>Resposta obrigatória</Checkbox>
    </article>
  );
}

function FormPreview({ draft, project }: { draft: Draft; project: IntakeFormProject | null }) {
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useMemo(() => {
    const grouped = new Map<number, IntakeQuestion[]>();
    draft.questions.forEach((question) => grouped.set(question.page, [...(grouped.get(question.page) ?? []), question]));
    return [...grouped.entries()].sort(([left], [right]) => left - right).map(([, questions]) => questions);
  }, [draft.questions]);
  const safePage = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const current = pages[safePage] ?? [];
  const last = safePage === pages.length - 1;

  return (
    <div className={styles.previewPaper} style={{ "--preview-hue": project ? `var(--sys-${project.hue})` : "var(--sys-blue)" } as CSSProperties}>
      <div className={styles.previewBrand}>{project && <ProjectMark project={{ ...project, hue: project.hue as never }} size="md" />}<div><span>{project?.reference ?? "PROJETO"}</span><strong>{project?.name ?? "Escolha um projeto"}</strong></div></div>
      <div className={styles.previewIntro}><h2>{draft.title || "Título do formulário"}</h2><p>{draft.description || "A introdução aparece aqui."}</p></div>
      <div className={styles.previewProgress}><span style={{ width: `${pages.length ? ((safePage + 1) / pages.length) * 100 : 0}%` }} /></div>
      <div className={styles.previewFields}>
        {current.map((question) => <PreviewField key={question.id} question={question} />)}
      </div>
      {last && <div className={styles.previewConsent}><Checkbox disabled>{draft.consentText || "Texto de consentimento"}</Checkbox></div>}
      <div className={styles.previewActions}>
        <IconButton label="Página anterior da prévia" size="sm" variant="ghost" disabled={safePage === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}><ArrowLeftIcon /></IconButton>
        <span>Página {safePage + 1} de {pages.length}</span>
        {last ? <Button size="sm" radius="md" disabled>{draft.submitLabel || "Enviar"}</Button> : <IconButton label="Próxima página da prévia" size="sm" variant="outline" onClick={() => setPageIndex((value) => Math.min(pages.length - 1, value + 1))}><ArrowRightIcon /></IconButton>}
      </div>
      <div className={styles.previewTrust}><EnvelopeSimpleIcon />As respostas serão enviadas com segurança.</div>
    </div>
  );
}

function PreviewField({ question }: { question: IntakeQuestion }) {
  const line = <span className={styles.fakeInput}>{question.placeholder || (question.type === "date" ? "dd/mm/aaaa" : "Sua resposta")}</span>;
  return <div className={styles.fakeField}><strong>{question.label}{question.required && " *"}</strong>{question.description && <small>{question.description}</small>}{question.type === "long_text" ? <span className={styles.fakeArea} /> : question.type === "single_choice" || question.type === "multiple_choice" ? <div className={styles.fakeChoices}>{question.options.slice(0, 3).map((option) => <span key={option}><i />{option}</span>)}</div> : line}</div>;
}
