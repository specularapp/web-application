"use client";

import { ChatCircleTextIcon, CopySimpleIcon, PlusIcon, StarIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action";
import { createFeedbackAction } from "../actions";
import { feedbackUrl } from "../share";
import type { ClientFeedback, FeedbackProjectOption } from "../summary";
import styles from "./feedbacks.module.css";

const status = {
  pending: { label: "Aguardando", tone: "warning" },
  submitted: { label: "Respondido", tone: "success" },
  closed: { label: "Encerrado", tone: "neutral" },
} as const;

export function FeedbacksBoard({ initialFeedbacks, projects }: { initialFeedbacks: ClientFeedback[]; projects: FeedbackProjectOption[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initialFeedbacks);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [title, setTitle] = useState("Como foi trabalhar conosco?");
  const [prompt, setPrompt] = useState("Sua avaliação nos ajuda a melhorar as próximas entregas.");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => !term || `${item.project.name} ${item.project.reference} ${item.reference}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [items, search]);

  const copy = async (item: ClientFeedback, directUrl?: string) => {
    const url = directUrl ?? feedbackUrl(item.shareToken);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link de avaliação copiado", description: "Envie ao cliente para receber a nota e o comentário.", tone: "success" });
    } catch {
      toast({ title: "Link de avaliação", description: url, tone: "neutral" });
    }
  };

  const create = async () => {
    if (!projectId) { setError("Escolha um projeto."); return; }
    setPending(true);
    setError("");
    const result = await callAction(createFeedbackAction({ projectId, title, prompt }));
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setItems((current) => [result.feedback, ...current.filter((item) => item.id !== result.feedback.id)]);
    setOpen(false);
    await copy(result.feedback, result.url);
  };

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: setSearch, label: "Buscar avaliação", placeholder: "Buscar por projeto ou referência" }}
        action={<Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setOpen(true)}>Nova avaliação</Button>}
      />
      {filtered.length === 0 ? (
        <EmptyState icon={ChatCircleTextIcon} title={search ? "Nenhuma avaliação encontrada" : "Nenhuma avaliação por aqui"} description={search ? "Tente outro projeto ou referência." : "Ao concluir um projeto, o link de avaliação será criado automaticamente."}>
          {!search && <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setOpen(true)}>Criar avaliação</Button>}
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <Card key={item.id} as="article" title={item.project.name} icon={<ChatCircleTextIcon />} action={<Button size="sm" variant="ghost" iconStart={<CopySimpleIcon />} onClick={() => void copy(item)}>Copiar link</Button>}>
              <div className={styles.cardBody}>
                <div className={styles.row}><span>{item.project.reference}</span><Badge tone={status[item.status].tone} size="sm">{status[item.status].label}</Badge></div>
                {item.rating ? <div className={styles.rating} aria-label={`${item.rating} de 5 estrelas`}>{Array.from({ length: 5 }, (_, index) => <StarIcon key={index} weight={index < item.rating! ? "fill" : "regular"} />)}</div> : <p>Aguardando a avaliação do cliente.</p>}
                {item.comment && <blockquote>{item.comment}</blockquote>}
                <div className={styles.meta}><span>{item.reference}</span>{item.respondentName && <span>Por {item.respondentName}</span>}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} label="Nova avaliação" size="md" surface="glass">
        <DialogHeader title="Nova avaliação" description="Um formulário curto para o cliente" onClose={() => setOpen(false)} />
        <div className={styles.form}>
          <Field label="Projeto" required error={!projectId ? error : undefined} revealError={Boolean(error) && !projectId}>
            <Select label="Projeto" searchable options={projects.map((project) => ({ value: project.id, label: `${project.name} ${project.reference}` }))} value={projectId} onChange={setProjectId} />
          </Field>
          <Field label="Título" required><Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Mensagem" required error={error && projectId ? error : undefined} revealError={Boolean(error) && Boolean(projectId)}>
            <Textarea value={prompt} maxLength={500} onChange={(event) => setPrompt(event.target.value)} />
          </Field>
        </div>
        <DialogFooter mobile="always"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={pending} onClick={() => void create()}>Criar e copiar link</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
