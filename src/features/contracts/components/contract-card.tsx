"use client";

import { BriefcaseIcon, CalendarBlankIcon, CheckIcon, ReceiptIcon } from "@phosphor-icons/react";
import { siteLabel } from "@/lib/utils/site";
import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded, roundedAuto } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { contractKinds, contractStatuses, dateOf } from "../labels";
import type { Contract } from "../summary";
import { ContractMenu, type ContractMenuActions } from "./contract-menu";
import styles from "./contract-card.module.css";

export type ContractCardProps = ContractMenuActions & {
  contract: Contract;
  /** Abre a ficha do contrato. */
  onOpen: () => void;
};

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão do contrato (2026-09-14, sobre uma referência de grade de cartões do usuário, adaptada aos padrões
// da casa): em cima o **tipo do trabalho** na etiqueta colorida da referência ("Landing page", "Branding"),
// a situação e o leque; o título e a descrição em até duas linhas cada; a **ficha pequena do vínculo**, o
// projeto com o endereço do site ou, sem projeto, o orçamento aprovado com o valor, num bloco no
// preenchimento da casa, como a da referência; e no pé **as duas partes**, quem contrata e quem responde pela
// equipe, com o check de quem já assinou na quina do rosto, e a data que importa na situação em que o
// contrato está (assinado em, vence em, criado em), na etiqueta com calendário da referência. O cartão
// inteiro abre a ficha; o leque tem ação própria. O fio da caixa é o do `Card`, em duas camadas recortadas
// pelo sistema de cantos.
export function ContractCard({ contract, onOpen, ...actions }: ContractCardProps) {
  const kind = contractKinds[contract.kind];
  const status = contractStatuses[contract.status];
  const date = dateOf(contract);
  const link = contract.project
    ? { icon: BriefcaseIcon, label: contract.project.name, caption: contract.project.url ? siteLabel(contract.project.url) : "Projeto vinculado" }
    : contract.quote
      ? { icon: ReceiptIcon, label: contract.quote.number, caption: formatMoney(contract.quote.amount) }
      : null;

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };

  // Só o teclado abre por tecla, e só quando o foco está no próprio cartão: dentro dele o Enter é do leque.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li className={styles.card} data-status={contract.status} {...rounded("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Abrir ${contract.title}, ${contract.reference}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...roundedAuto({ clip: true })}
      >
        <header className={styles.head}>
          <Badge size="sm" hue={kind.hue}>
            {kind.label}
          </Badge>
          <span className={styles.end}>
            <Badge tone={status.tone} size="sm" icon={<status.icon />}>
              {status.label}
            </Badge>
            <ContractMenu contract={contract} onOpen={onOpen} {...actions} />
          </span>
        </header>

        <div className={styles.copy}>
          <Text as="h2" variant="headline" weight="semibold" className={styles.title}>
            {contract.title}
          </Text>
          <Text variant="footnote" tone="secondary" className={styles.description}>
            {contract.description}
          </Text>
        </div>

        {/* A ficha pequena do vínculo, como a da referência: o glifo num azulejo, o nome e, embaixo, o
            endereço do site do projeto ou o valor do orçamento. */}
        {link && (
          <div className={styles.link} {...rounded("md")}>
            <span className={styles.linkIcon} aria-hidden="true" {...rounded("sm")}>
              <link.icon weight="duotone" />
            </span>
            <span className={styles.linkCopy}>
              <Text as="span" variant="footnote" weight="medium" truncate>
                {link.label}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {link.caption}
              </Text>
            </span>
          </div>
        )}

        {/* O pé: as partes de um lado, com o check de quem já assinou, e a data do outro. Os nomes e o estado
            de cada assinatura seguem na leitura por voz. */}
        <div className={styles.foot}>
          <span className={styles.parties} aria-hidden="true">
            {contract.parties.map((party) => (
              <span key={party.id} className={styles.party} title={party.signedAt ? `${party.name} assinou` : `${party.name} ainda não assinou`}>
                <Avatar name={party.name} src={party.avatarUrl ?? undefined} size="xs" className={styles.face} />
                {party.signedAt && (
                  <span className={styles.mark}>
                    <CheckIcon weight="bold" />
                  </span>
                )}
              </span>
            ))}
          </span>
          <VisuallyHidden>{contract.parties.map((party) => `${party.name}: ${party.signedAt ? "assinou" : "ainda não assinou"}`).join(". ")}</VisuallyHidden>
          <Badge tone={date.tone} size="sm" icon={<CalendarBlankIcon />}>
            {date.label}
          </Badge>
        </div>
      </div>
    </li>
  );
}
