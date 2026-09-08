"use client";

import { XIcon } from "@phosphor-icons/react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { DropdownAction, DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import styles from "./filter-sheet.module.css";

export type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  sections: DropdownSection[];
};

/* Seção sem título e só com ações simples (nem escolha, nem interruptor) é o rodapé: é onde mora o
   "Limpar filtros". As outras viram grupos de fichas. */
function isFooter(section: DropdownSection) {
  return !section.label && section.items.every((item) => item.kind !== "toggle" && item.selected === undefined);
}

// A bandeja de filtros do celular: os mesmos dados que o menu de vidro mostra no desktop, arrumados
// para o dedo. Cada grupo tem o título em cima e as opções em fichas lado a lado, a escolhida com fundo
// e as outras só com o fio, então dá para ler todos os grupos de uma vez e ver o que está em vigor sem
// procurar um check no fim de cada linha, que era o que a lista corrida do menu pedia. Escolher vale na
// hora e não fecha; "Pronto" fecha, e o limpar fica no rodapé, ao lado.
export function FilterSheet({ open, onClose, sections }: FilterSheetProps) {
  const id = useId();
  const groups = sections.filter((section) => !isFooter(section));
  const footer = sections.filter(isFooter).flatMap((section) => section.items as DropdownAction[]);

  return (
    <Dialog open={open} onClose={onClose} label="Filtros" surface="glass" scrim={false} focusOnOpen={false}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          <Text as="h2" variant="headline" weight="semibold">
            Filtros
          </Text>
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </header>

        <div className={styles.body}>
          {groups.map((section) => {
            const titleId = `${id}-${section.id}`;
            const exclusive = section.items.some((item) => item.kind !== "toggle" && item.selected !== undefined);

            return (
              <section key={section.id} className={styles.group} aria-labelledby={titleId}>
                <Text as="h3" id={titleId} variant="footnote" weight="semibold" tone="secondary">
                  {section.label}
                </Text>
                <div className={styles.chips} role={exclusive ? "radiogroup" : undefined} aria-labelledby={exclusive ? titleId : undefined}>
                  {section.items.map((item) => {
                    const Glyph = item.icon;
                    const glyph = Glyph && <Glyph aria-hidden="true" />;

                    if (item.kind === "toggle") {
                      return (
                        <button key={item.id} type="button" className={styles.chip} aria-pressed={item.checked} onClick={() => item.onChange(!item.checked)}>
                          {glyph}
                          {item.label}
                        </button>
                      );
                    }

                    return (
                      <button key={item.id} type="button" role="radio" className={styles.chip} aria-checked={item.selected ?? false} onClick={item.onSelect}>
                        {glyph}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className={styles.foot}>
          <span className={styles.footStart}>
            {footer.map((item) => {
              const Glyph = item.icon;
              return (
                <Button key={item.id} variant="ghost" size="sm" radius="md" iconStart={Glyph && <Glyph />} onClick={item.onSelect}>
                  {item.label}
                </Button>
              );
            })}
          </span>
          <Button size="sm" radius="md" onClick={onClose}>
            Pronto
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
