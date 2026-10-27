"use client";

import type { Icon } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";
import { useTabList } from "@/hooks/use-tab-list";
import { Text } from "../text";
import styles from "./form-window.module.css";

/**
 * As peças da janela dupla de criar e editar (2026-10-26): a do item do catálogo e a do contato de clientes e
 * fornecedores são a mesma janela, então o desenho mora aqui, num lugar só. Quem monta passa
 * `formWindow.window` como `className` da `Dialog` `xl` sólida e põe dois filhos dentro: o formulário
 * (`formWindow.formCard`, com `head`, `body` e `cardFoot`) e a prévia (`formWindow.preview`, em `block`s).
 */
export const formWindow = styles;

export type FormWindowStep<T extends string> = { value: T; label: string; icon: Icon };

/** As abas de pasta no cabeçalho escuro, com a escolhida emendando no corpo. */
export function FormWindowTabs<T extends string>({ label, steps, value, onChange }: { label: string; steps: readonly FormWindowStep<T>[]; value: T; onChange: (next: T) => void }) {
  const tabs = useTabList(
    steps.map((step) => step.value),
    value,
    onChange,
  );
  return (
    <div className={styles.tabs}>
      <div className={styles.tabList} aria-label={label} {...tabs.listProps}>
        {steps.map(({ value: step, label: name, icon: Glyph }) => (
          <button key={step} type="button" className={styles.tab} onClick={() => onChange(step)} {...tabs.tabProps(step)}>
            <Glyph aria-hidden="true" weight={value === step ? "duotone" : "regular"} />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Uma seção numerada, na receita dos editores da Le Ange, num painel de fundo leve que destaca o grupo: o
 * número em texto puro com o nome e a dica em poucas palavras à esquerda, e os campos à direita.
 */
export function FormWindowPart({ number, title, hint, children }: { number: number; title: string; hint: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.part} aria-labelledby={id}>
      <header className={styles.partAside}>
        <Text as="h3" id={id} variant="subheadline" weight="semibold">
          <span className={styles.partNumber}>{number}.</span> {title}
        </Text>
        <Text as="span" variant="caption1" tone="secondary">
          {hint}
        </Text>
      </header>
      <div className={styles.partFields}>{children}</div>
    </section>
  );
}

export type FormWindowRow = { label: string; value: ReactNode; icon?: Icon; title?: string };

/** Um bloco da prévia: o rótulo em caixa alta e o que ele mostra embaixo. */
export function FormWindowBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.block} aria-label={title}>
      <Text as="h4" variant="caption1" weight="semibold" tone="secondary" className={styles.sheetEyebrow}>
        {title}
      </Text>
      {children}
    </section>
  );
}

/** As linhas de rótulo e valor da prévia: o rótulo à esquerda, com glifo quando há, e o valor à direita. */
export function FormWindowRows({ rows }: { rows: readonly FormWindowRow[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map(({ label, value, icon: Glyph, title }) => (
        <div key={label}>
          <dt title={title}>
            {Glyph && <Glyph aria-hidden="true" />}
            {label}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
