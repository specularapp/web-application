"use client";

import { UsersThreeIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import type { TaskAccessPerson, TaskAccessTarget } from "../access";
import { loadTaskAccessAction, setTaskAccessAction } from "../access-actions";
import styles from "./access-dialog.module.css";

/**
 * Quem acessa uma página ou uma pasta de tarefas (2026-10-28, a pedido: "faça essa funcionalidade ficar direto na
 * edição da pasta e página"): as pessoas do cargo só de tarefas, cada uma com um interruptor. Liberar a pasta
 * libera tudo o que está dentro dela; quem já vê por uma pasta de cima aparece ligado e travado, com o nome dela.
 * Cada interruptor salva na hora.
 */
export function TaskAccessDialog({ target, onClose }: { target: TaskAccessTarget | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onClose={onClose} label={target ? `Quem acessa ${target.name}` : "Acesso"} size="sm" surface="solid" focusOnOpen={false}>
      {target && <AccessBody key={`${target.kind}-${target.id}`} target={target} onClose={onClose} />}
    </Dialog>
  );
}

function AccessBody({ target, onClose }: { target: TaskAccessTarget; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [people, setPeople] = useState<TaskAccessPerson[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void callAction(loadTaskAccessAction(target)).then((result) => {
      if (!alive) return;
      if (result.ok) setPeople(result.people);
      else {
        setPeople([]);
        toast({ title: "Não deu para abrir o acesso", description: result.error, tone: "danger" });
      }
    });
    return () => {
      alive = false;
    };
  }, [target, toast]);

  const toggle = async (person: TaskAccessPerson, granted: boolean) => {
    setBusy(person.userId);
    setPeople((current) => current?.map((entry) => (entry.userId === person.userId ? { ...entry, granted } : entry)) ?? current);
    const result = await callAction(setTaskAccessAction({ kind: target.kind, id: target.id, userId: person.userId, granted }));
    setBusy(null);
    if (!result.ok) {
      setPeople((current) => current?.map((entry) => (entry.userId === person.userId ? { ...entry, granted: !granted } : entry)) ?? current);
      toast({ title: "Não deu para salvar", description: result.error, tone: "danger" });
      return;
    }
    router.refresh();
  };

  return (
    <div className={styles.body}>
      <DialogHeader
        title="Quem acessa"
        description={target.kind === "folder" ? `${target.name}, e tudo o que está dentro dela` : target.name}
        onClose={onClose}
      />
      <div className={styles.list}>
        {people === null ? (
          <div className={styles.loading}>
            <Spinner label="Carregando quem acessa" />
          </div>
        ) : people.length === 0 ? (
          <EmptyState
            icon={UsersThreeIcon}
            size="sm"
            title="Ninguém no cargo Só tarefas"
            description="Mude o cargo de alguém para Só tarefas em Configurações, Equipe, e libere aqui as páginas que a pessoa pode ver."
          />
        ) : (
          <ul className={styles.people}>
            {people.map((person) => {
              const inherited = person.inheritedFrom !== null;
              return (
                <li key={person.userId} className={styles.person}>
                  <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="sm" />
                  <span className={styles.who}>
                    <Text as="span" variant="footnote" weight="medium" truncate>
                      {person.name}
                    </Text>
                    <Text as="span" variant="caption1" tone="secondary" truncate>
                      {inherited ? `Já vê pela pasta ${person.inheritedFrom}` : (person.email ?? "Sem e-mail")}
                    </Text>
                  </span>
                  <Switch
                    size="sm"
                    checked={inherited || person.granted}
                    disabled={inherited || busy === person.userId}
                    aria-label={`${person.granted ? "Tirar" : "Liberar"} o acesso de ${person.name}`}
                    onChange={(event) => void toggle(person, event.target.checked)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
