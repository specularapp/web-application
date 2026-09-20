"use client";

import { ArchiveIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { archiveTeamAction } from "@/features/organizations/actions";
import styles from "./archive-team-dialog.module.css";
import { callAction } from "@/lib/action";

export type ArchiveTeamDialogProps = {
  /** A equipe prestes a ser arquivada; nula fecha a janela. */
  team: { id: string; name: string } | null;
  onClose: () => void;
};

/**
 * A confirmação de arquivar uma equipe. É o lugar do excluir (2026-09-16, a pedido): nada é apagado, a
 * equipe só sai da lista e ninguém entra nela, e desarquivar traz tudo de volta. O texto diz isso com todas
 * as letras, porque quem clica em algo vermelho precisa saber se perde o trabalho ou não.
 *
 * Só quem é dono consegue: quem decide é o banco, e o erro dele chega aqui como aviso.
 */
export function ArchiveTeamDialog({ team, onClose }: ArchiveTeamDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const archive = async () => {
    if (!team) return;
    setBusy(true);
    const result = await callAction(archiveTeamAction({ organizationId: team.id, archived: true }));
    setBusy(false);

    if (!result.ok) {
      toast({ title: "Não foi possível arquivar", description: result.error, tone: "danger" });
      return;
    }

    toast({ title: "Equipe arquivada", description: `${team.name} saiu da sua lista.`, tone: "success" });
    onClose();
  };

  return (
    <Dialog open={team !== null} onClose={() => !busy && onClose()} label="Arquivar equipe" size="sm" focusOnOpen={false}>
      <Body name={team?.name ?? ""} busy={busy} onConfirm={() => void archive()} onCancel={onClose} />
    </Dialog>
  );
}

/* No celular arquivar e cancelar moram na barra flutuante, acima da bandeja, como em toda janela da casa.
   Num componente à parte porque o registro só pode acontecer com a janela montada. */
function Body({ name, busy, onConfirm, onCancel }: { name: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  useFloatingActionsRegistration({
    primary: { label: busy ? "Arquivando" : "Arquivar", icon: <ArchiveIcon weight="bold" />, loading: busy, onClick: onConfirm },
    cancel: { label: "Cancelar", onClick: onCancel },
  });

  return (
    <div className={styles.dialog}>
      <Text as="h2" variant="headline" weight="semibold">
        Arquivar {name}?
      </Text>
      <Text variant="footnote" tone="secondary">
        Ela sai da sua lista de equipes e ninguém entra nela. Nada é apagado: clientes, projetos, contratos e
        cobranças continuam onde estão, e dá para reabrir depois.
      </Text>

      <div className={styles.actions}>
        <Button variant="ghost" size="md" radius="md" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="danger" size="md" radius="md" loading={busy} iconStart={<ArchiveIcon />} onClick={onConfirm}>
          {busy ? "Arquivando" : "Arquivar"}
        </Button>
      </div>
    </div>
  );
}
