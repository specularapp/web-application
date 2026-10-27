"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { callAction } from "@/lib/action";
import { attachBoardAction, listBoardTargetsAction } from "../actions";
import styles from "./attach-board-dialog.module.css";

type Target = { id: string; name: string; reference: string };

export type AttachBoardDialogProps = {
  board: { id: string; name: string };
  onClose: () => void;
  /** Depois de atrelar: a página some da árvore, então quem está nela precisa ir para outro lugar. */
  onAttached: () => void;
};

/**
 * Atrela a página avulsa de Tarefas a um projeto de verdade (2026-10-26, a pedido). As tarefas, as etapas que
 * elas usam e o tempo apontado vão para o projeto, e a página sai da árvore.
 */
export function AttachBoardDialog({ board, onClose, onAttached }: AttachBoardDialogProps) {
  const { toast } = useToast();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listBoardTargetsAction().then((list) => {
      if (active) setTargets(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const attach = async () => {
    if (!projectId) {
      setError("Escolha o projeto.");
      return;
    }
    setPending(true);
    setError("");
    const result = await callAction(attachBoardAction({ boardId: board.id, projectId }));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const target = targets?.find((entry) => entry.id === projectId);
    toast({ title: "Página atrelada", description: `As tarefas de ${board.name} agora estão em ${target?.name ?? "o projeto"}.`, tone: "success" });
    onAttached();
  };

  const empty = targets !== null && targets.length === 0;

  return (
    <Dialog open onClose={onClose} label={`Atrelar ${board.name} a um projeto`} size="sm" surface="glass">
      <DialogHeader
        title="Atrelar a um projeto"
        description={`As tarefas de ${board.name} vão para o projeto escolhido, e a página sai da árvore.`}
        onClose={onClose}
      />
      <div className={styles.form}>
        <Field
          label="Projeto"
          required
          error={empty ? "Nenhum projeto em andamento para receber a página." : error || undefined}
          revealError={empty || Boolean(error)}
        >
          <Select
            label="Projeto"
            searchable
            disabled={targets === null || empty}
            placeholder={targets === null ? "Carregando projetos" : "Escolha o projeto"}
            options={(targets ?? []).map((target) => ({ value: target.id, label: `${target.name} ${target.reference}` }))}
            value={projectId}
            onChange={setProjectId}
          />
        </Field>
      </div>
      <DialogFooter mobile="always">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button loading={pending} disabled={!projectId} onClick={() => void attach()}>
          Atrelar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
