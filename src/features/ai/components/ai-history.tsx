"use client";

import { ChatsCircleIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { rounded } from "@/lib/corners";
import { aiHistory, type AiConversation } from "../conversation";
import { aiRemaining, aiTone } from "../summary";
import { useAiPanel } from "./ai-panel-context";
import { AiUsageDialog } from "./ai-usage-dialog";
import styles from "./ai-history.module.css";

export type AiHistoryProps = {
  /** Escolher uma conversa fecha a gaveta, quando o histórico está dentro de uma. */
  onPick?: () => void;
};

/* Passando disto, a lista deixa de ser lida de relance e passa a ser procurada, o mesmo corte do leque de
   opções da casa. */
const SEARCH_FROM = 5;

/**
 * A trilha de conversas da página cheia: começar uma nova, procurar nas antigas e voltar a qualquer uma
 * delas, com o uso do ciclo no pé. É a parte que a coluna lateral não tem como oferecer, porque lá o
 * histórico cabe num leque e aqui ele é a lista que fica à vista o tempo todo.
 *
 * As conversas vêm do provedor da concha, o mesmo da coluna: perguntar numa tela e continuar aqui é a mesma
 * conversa, e não duas listas que não se conhecem.
 */
export function AiHistory({ onPick }: AiHistoryProps) {
  const panel = useAiPanel();
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [usageOpen, setUsageOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  /* Escape sai sem salvar, e sair do campo salva. Como fechar o campo tira o foco dele, o `blur` chegaria
     depois do Escape e salvaria assim mesmo: esta marca é o que diz a ele para não fazer nada. */
  const cancelled = useRef(false);

  useEffect(() => {
    if (renaming) field.current?.select();
  }, [renaming]);

  if (!panel) return null;

  const conversations = panel.conversations;
  const groups = aiHistory(conversations, search);
  const usage = panel.data?.usage;

  const start = (conversation: AiConversation) => {
    cancelled.current = false;
    setDraft(conversation.title);
    setRenaming(conversation.id);
  };

  const save = () => {
    if (renaming && !cancelled.current) panel.rename(renaming, draft);
    setRenaming(null);
  };

  const menuOf = (conversation: AiConversation): DropdownSection[] => [
    {
      id: "editar",
      items: [{ id: "renomear", label: "Renomear", icon: PencilSimpleIcon, onSelect: () => start(conversation) }],
    },
    {
      id: "remover",
      items: [{ id: "excluir", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: () => panel.remove(conversation.id) }],
    },
  ];

  return (
    <div className={styles.history}>
      <div className={styles.head}>
        {/* A ação principal da trilha no desenho que toda ação principal da casa tem: primário, tamanho
            pequeno, canto md e o mais na frente, o mesmo de "Novo cliente" e "Novo projeto". Só a largura
            cheia é daqui, porque numa trilha de dezessete rem um botão curto no canto fica solto. */}
        <Button
          size="sm"
          radius="md"
          fullWidth
          iconStart={<PlusIcon />}
          onClick={() => {
            panel.reset();
            onPick?.();
          }}
        >
          Nova conversa
        </Button>

        {conversations.length >= SEARCH_FROM && (
          <Input
            size="sm"
            value={search}
            placeholder="Procurar na conversa"
            aria-label="Procurar nas conversas"
            iconStart={<MagnifyingGlassIcon />}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
      </div>

      <div className={styles.scroller}>
        {groups.length === 0 ? (
          <Text as="p" variant="caption1" tone="tertiary" className={styles.empty}>
            {conversations.length === 0 ? "O que você perguntar aparece aqui." : "Nenhuma conversa com esse termo."}
          </Text>
        ) : (
          groups.map((group) => (
            <section key={group.id} className={styles.group}>
              <Text as="h2" variant="caption2" weight="medium" tone="tertiary" className={styles.groupName}>
                {group.label}
              </Text>
              <ul className={styles.list}>
                {group.conversations.map((conversation) => (
                  <li
                    key={conversation.id}
                    className={styles.row}
                    data-current={conversation.id === panel.currentId || undefined}
                    {...rounded("md")}
                  >
                    {renaming === conversation.id ? (
                      <Input
                        ref={field}
                        size="sm"
                        value={draft}
                        aria-label={"Novo nome de " + conversation.title}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={save}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            save();
                          }
                          if (event.key === "Escape") {
                            cancelled.current = true;
                            setRenaming(null);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.pick}
                          onClick={() => {
                            panel.resume(conversation.id);
                            onPick?.();
                          }}
                        >
                          <ChatsCircleIcon className={styles.rowGlyph} />
                          <Text as="span" variant="footnote" truncate className={styles.rowName}>
                            {conversation.title}
                          </Text>
                        </button>
                        <span className={styles.rowEnd}>
                          <DropdownMenu
                            label={"Opções de " + conversation.title}
                            triggerLabel={"Mais opções de " + conversation.title}
                            sections={menuOf(conversation)}
                            size="sm"
                          />
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* O saldo do ciclo no pé, onde mora o rodapé de toda trilha: a régua em dez degraus, a mesma do topo
          da página e da janela do uso, e o clique abre o resumo com a data em que o ciclo vira. */}
      {usage && (
        <footer className={styles.foot}>
          <button type="button" className={styles.usage} onClick={() => setUsageOpen(true)} {...rounded("md")}>
            <span className={styles.usageLine}>
              <Text as="span" variant="caption2" tone="secondary">
                Uso da IA
              </Text>
              <Text as="span" variant="caption2" tone="secondary">
                {aiRemaining(usage)} restantes
              </Text>
            </span>
            <Progress
              value={usage.used}
              max={usage.limit}
              tone={aiTone(usage)}
              size="xs"
              segments={10}
              aria-label={`${usage.used} de ${usage.limit} ações de IA usadas neste ciclo`}
            />
          </button>
          <AiUsageDialog usage={usage} open={usageOpen} onClose={() => setUsageOpen(false)} />
        </footer>
      )}
    </div>
  );
}
