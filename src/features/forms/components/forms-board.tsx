"use client";

import { ClipboardTextIcon, CopySimpleIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UsersThreeIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { callAction } from "@/lib/action";
import { deleteIntakeFormAction } from "../actions";
import { formStatusLabels } from "../labels";
import { intakeFormUrl } from "../share";
import type { IntakeFormClient, IntakeFormListItem, IntakeFormProject } from "../summary";
import styles from "./forms-board.module.css";

const statusTone = { draft: "neutral", published: "success", closed: "warning" } as const;

export function FormsBoard({ forms }: { forms: IntakeFormListItem[]; projects: IntakeFormProject[]; clients: IntakeFormClient[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<IntakeFormListItem | null>(null);
  const [pending, setPending] = useState(false);
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return forms.filter((form) => !removed.includes(form.id) && (!term || `${form.title} ${form.reference} ${form.project.name}`.toLocaleLowerCase("pt-BR").includes(term)));
  }, [forms, removed, search]);

  const copy = async (form: IntakeFormListItem) => {
    if (form.status !== "published") {
      toast({ title: "Publique antes de compartilhar", description: "Abra o formulário, confira a prévia e use Publicar.", tone: "warning" });
      return;
    }
    const url = intakeFormUrl(form.shareToken);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "O formulário está pronto para enviar ao cliente.", tone: "success" });
    } catch {
      toast({ title: "Link do formulário", description: url, tone: "neutral" });
    }
  };

  const remove = async () => {
    if (!confirming) return;
    setPending(true);
    const result = await callAction(deleteIntakeFormAction(confirming.id));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }
    setRemoved((current) => [...current, confirming.id]);
    setConfirming(null);
    toast({ title: "Formulário excluído", description: "O link público deixou de funcionar.", tone: "success" });
  };

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: setSearch, label: "Buscar formulário", placeholder: "Buscar por formulário ou projeto" }}
        action={<Button href="/formularios/novo" size="sm" radius="md" iconStart={<PlusIcon />}>Novo formulário</Button>}
      />
      {items.length === 0 ? (
        <EmptyState icon={ClipboardTextIcon} title={search ? "Nenhum formulário encontrado" : "Nenhum formulário por aqui"} description={search ? "Tente outro nome de formulário ou projeto." : "Crie perguntas, publique o link e receba as respostas direto na base."}>
          {!search && <Button href="/formularios/novo" size="sm" radius="md" iconStart={<PlusIcon />}>Criar formulário</Button>}
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {items.map((form) => (
            <Card
              key={form.id}
              as="article"
              className={styles.card}
              title={form.title}
              icon={<ProjectMark project={{ ...form.project, hue: form.project.hue as never }} size="sm" />}
              action={
                <DropdownMenu
                  label={`Ações de ${form.title}`}
                  triggerLabel={`Abrir ações de ${form.title}`}
                  size="sm"
                  sections={[{
                    id: "actions",
                    items: [
                      { id: "responses", label: "Ver respostas", icon: UsersThreeIcon, href: `/formularios/${form.id}/respostas` as Route },
                      { id: "copy", label: "Copiar link público", icon: CopySimpleIcon, onSelect: () => void copy(form) },
                      { id: "edit", label: "Editar formulário", icon: PencilSimpleIcon, href: `/formularios/${form.id}` as Route },
                      { id: "delete", label: "Excluir formulário", icon: TrashIcon, tone: "danger", onSelect: () => setConfirming(form) },
                    ],
                  }]}
                />
              }
            >
              <button type="button" className={styles.cardMain} onClick={() => router.push(`/formularios/${form.id}` as Route)}>
                <div className={styles.cardHead}>
                  <div className={styles.names}><strong>{form.project.name}</strong><span>{form.project.reference}</span></div>
                  <Badge tone={statusTone[form.status]} size="sm">{formStatusLabels[form.status]}</Badge>
                </div>
                <p>{form.description || "Formulário de informações do projeto"}</p>
                <div className={styles.meta}><span>{form.reference}</span><span><UsersThreeIcon />{form.responseCount} {form.responseCount === 1 ? "resposta" : "respostas"}</span></div>
              </button>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(confirming)} pending={pending} title="Excluir este formulário?" description="As respostas já recebidas e o link público serão removidos. Isso não pode ser desfeito." onClose={() => setConfirming(null)} onConfirm={() => void remove()} />
    </div>
  );
}
