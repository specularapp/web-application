"use client";

import styled from "@emotion/styled";
import { XIcon } from "@phosphor-icons/react";
import { useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { Dialog, type DialogProps, type DialogSize } from "../dialog";
import { IconButton } from "../icon-button";
import { Text } from "../text";
import styles from "./details-dialog.module.css";

export type DetailFact = { label: string; value: string };

export type DetailsSummary = {
  title: string;
  subtitle?: string;
  /** Etiqueta ou avatar ao lado do título. */
  leading?: ReactNode;
  facts: DetailFact[];
  /** Texto corrido no fim, como a descrição inteira. */
  note?: string;
};

export type DetailsTriggerProps = Omit<HTMLAttributes<HTMLElement>, "onClick" | "onKeyDown" | "role" | "tabIndex"> & {
  /** O elemento da linha, que continua sendo o que era: `li` na lista, `div` no destaque, ou um `button` de verdade. */
  as?: "li" | "div" | "button";
  /** O que a janela mostra, na ficha padrão. */
  summary?: DetailsSummary;
  /** Conteúdo próprio da janela, no lugar da ficha padrão (o recibo da movimentação, por exemplo); só o X de fechar entra por fora. */
  dialog?: ReactNode;
  /** Nome da janela para leitor de tela quando há conteúdo próprio. */
  dialogLabel?: string;
  /** Largura da janela; a ficha padrão cabe em `sm`, a ficha completa da tarefa pede `md`. */
  dialogSize?: DialogSize;
  /** Nome do gatilho para leitor de tela, como "Ver detalhes de Camila Ferreira". */
  label: string;
  children: ReactNode;
};

export type DetailsDialogProps = Pick<DialogProps, "open" | "onClose" | "label" | "size"> & { children: ReactNode };

/** Controles de dentro da linha que têm a própria ação e não abrem a janela, a menos que se declarem. */
const INTERACTIVE = "button, a, input, select, textarea, [role='button'], [role='menuitem']";

/* Conteúdo próprio rola por dentro, sem recuo: quem entra traz o seu. */
const Custom = styled.div`
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
`;

/* Com conteúdo próprio, o X flutua na quina de cima à direita da janela. */
const FloatingClose = styled.span`
  position: absolute;
  inset-block-start: var(--space-3);
  inset-inline-end: var(--space-3);
  z-index: 1;
`;

const Header = styled.header`
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-block-end: 0.0375rem solid var(--color-border);
`;

const Heading = styled.div`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

const Body = styled.div`
  display: grid;
  gap: var(--space-4);
  min-height: 0;
  padding: var(--space-5);
  overflow-y: auto;
  overscroll-behavior: contain;
`;

/* A ficha em duas colunas, rótulo apagado em cima e valor embaixo, como nas fichas dos blocos. */
const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-3);
  margin: 0;
`;

const Fact = styled.div`
  display: grid;
  gap: var(--space-half);
  min-width: 0;

  & dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
`;

// A janela de conteúdo próprio: vidro, o X flutuando na quina de cima à direita e o conteúdo rolando por
// dentro, sem recuo. É o que o gatilho abre quando recebe `dialog`, e o que um botão de cabeçalho abre por
// conta própria.
export function DetailsDialog({ open, onClose, label, size = "sm", children }: DetailsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label={label} size={size} surface="glass">
      <FloatingClose>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </FloatingClose>
      <Custom>{children}</Custom>
    </Dialog>
  );
}

// Um resumo em janela: clicar na linha abre a janela da casa (centralizada no desktop, bandeja no
// celular, em vidro e com o fundo escurecido) com o título, o subtítulo, a ficha em duas colunas e uma
// nota no fim, ou o conteúdo próprio que a linha trouxer (o recibo). A linha continua sendo o elemento que era, com as mesmas classes: o gatilho só lhe dá
// papel de botão, foco por teclado (Enter e Espaço) e o clique; como `button` ele já é botão e dispensa os dois. Clique que nasce num controle de dentro
// (o menu do cliente, por exemplo) não abre a janela, a menos que o controle traga `data-open-details`.
export function DetailsTrigger({ as = "li", summary, dialog, dialogLabel, dialogSize = "sm", label, children, className, ...props }: DetailsTriggerProps) {
  const [open, setOpen] = useState(false);
  // As duas tags aceitam os mesmos atributos genéricos; o tipo único evita a união que o TypeScript não fecha.
  const Tag = as as "div";

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget && !control.hasAttribute("data-open-details")) return;
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <Tag
        {...(as === "button" ? { type: "button" } : { role: "button", tabIndex: 0 })}
        aria-haspopup="dialog"
        aria-label={label}
        className={cx(styles.trigger, className)}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...props}
      >
        {children}
      </Tag>

      {dialog ? (
        <DetailsDialog open={open} onClose={() => setOpen(false)} label={dialogLabel ?? label} size={dialogSize}>
          {dialog}
        </DetailsDialog>
      ) : (
        <Dialog open={open} onClose={() => setOpen(false)} label={summary?.title ?? label} size={dialogSize} surface="glass">
          {summary && (
            <>
              <Header>
                {summary.leading}
                <Heading>
                  <Text as="h2" variant="headline" weight="semibold" truncate>
                    {summary.title}
                  </Text>
                  {summary.subtitle && (
                    <Text variant="footnote" tone="secondary" truncate>
                      {summary.subtitle}
                    </Text>
                  )}
                </Heading>
                <IconButton label="Fechar" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  <XIcon />
                </IconButton>
              </Header>

              <Body>
                <Facts>
                  {summary.facts.map((fact) => (
                    <Fact key={fact.label}>
                      <Text as="dt" variant="caption1" tone="secondary">
                        {fact.label}
                      </Text>
                      <Text as="dd" variant="subheadline" weight="medium">
                        {fact.value}
                      </Text>
                    </Fact>
                  ))}
                </Facts>
                {summary.note && (
                  <Text variant="footnote" tone="secondary">
                    {summary.note}
                  </Text>
                )}
              </Body>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
