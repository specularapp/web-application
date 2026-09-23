"use client";

import { CheckSquareOffsetIcon, CopySimpleIcon, EyeIcon, PlusIcon, StackIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
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
import { createApprovalAction } from "../actions";
import { approvalStatuses } from "../labels";
import { approvalUrl } from "../share";
import type { ApprovalListItem, ApprovalProjectOption } from "../summary";
import styles from "./approvals.module.css";

export function ApprovalsBoard({ approvals, projects }: { approvals: ApprovalListItem[]; projects: ApprovalProjectOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return approvals.filter((item) => !term || `${item.title} ${item.reference} ${item.project.name}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [approvals, search]);

  const create = async () => {
    if (!projectId) { setError("Escolha um projeto."); return; }
    setPending(true);
    setError("");
    const result = await callAction(createApprovalAction({ projectId, title, description }));
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    router.push(`/aprovacoes/${result.id}` as Route);
  };

  const copy = async (item: ApprovalListItem) => {
    if (!item.latestVersion) { toast({ title: "Adicione uma versão", description: "O link será liberado quando houver algo para o cliente avaliar.", tone: "warning" }); return; }
    const url = approvalUrl(item.shareToken);
    try { await navigator.clipboard.writeText(url); toast({ title: "Link de aprovação copiado", description: "O cliente verá a versão mais recente e o histórico.", tone: "success" }); }
    catch { toast({ title: "Link de aprovação", description: url, tone: "neutral" }); }
  };

  return (
    <div className={styles.board}>
      <PageToolbar search={{ value: search, onChange: setSearch, label: "Buscar aprovação", placeholder: "Buscar por entrega, projeto ou referência" }} action={<Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setOpen(true)}>Nova aprovação</Button>} />
      {items.length === 0 ? (
        <EmptyState icon={CheckSquareOffsetIcon} title={search ? "Nenhuma aprovação encontrada" : "Nenhuma aprovação por aqui"} description={search ? "Tente outro termo." : "Envie uma URL ou imagens e acompanhe cada versão até a decisão do cliente."}>
          {!search && <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setOpen(true)}>Criar aprovação</Button>}
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <Card key={item.id} as="article" title={item.title} icon={<CheckSquareOffsetIcon />} action={<Button variant="ghost" size="sm" iconStart={<CopySimpleIcon />} onClick={() => void copy(item)}>Copiar link</Button>}>
              <div className={styles.cardBody}>
                <div className={styles.row}><strong>{item.project.name}</strong><Badge tone={approvalStatuses[item.status].tone} size="sm">{approvalStatuses[item.status].label}</Badge></div>
                <p>{item.description || "Entrega pronta para revisão do cliente"}</p>
                <div className={styles.meta}><span><StackIcon /> {item.versionCount} {item.versionCount === 1 ? "versão" : "versões"}</span><span>{item.reference}</span></div>
                <Button href={`/aprovacoes/${item.id}` as Route} variant="outline" size="sm" iconStart={<EyeIcon />}>Abrir aprovação</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} label="Nova aprovação" size="md" surface="glass">
        <DialogHeader title="Nova aprovação" description="Defina o projeto e o que será avaliado" onClose={() => setOpen(false)} />
        <div className={styles.form}>
          <Field label="Projeto" required error={!projectId ? error : undefined} revealError={Boolean(error) && !projectId}><Select label="Projeto" searchable options={projects.map((project) => ({ value: project.id, label: `${project.name} ${project.reference}` }))} value={projectId} onChange={setProjectId} /></Field>
          <Field label="Título" required><Input value={title} maxLength={120} placeholder="Exemplo: Aprovação da página inicial" onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Contexto" error={projectId ? error : undefined} revealError={Boolean(error) && Boolean(projectId)}><Textarea value={description} maxLength={1200} placeholder="Explique o que o cliente deve conferir" onChange={(event) => setDescription(event.target.value)} /></Field>
        </div>
        <DialogFooter mobile="always"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={pending} onClick={() => void create()}>Continuar</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
