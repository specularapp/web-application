import { ArrowsClockwiseIcon, BankIcon, CalendarBlankIcon, ReceiptIcon, TagIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formWindow, FormWindowBlock, FormWindowRows } from "@/components/ui/form-window";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { chargeMethods, recurrenceLabels } from "../labels";
import type { ChargeDirection, ChargeMethod, ChargeRecurrence } from "../summary";
import { dateBr } from "./money";
import styles from "./charge-preview.module.css";

export type ChargePreviewDraft = {
  direction: ChargeDirection;
  party: string;
  avatar: { name: string; url: string | null } | null;
  title: string;
  amount: number;
  method: ChargeMethod;
  recurrence: ChargeRecurrence;
  account: string;
  category: { name: string; hue: string } | null;
  installments: { number: number; amount: number; dueDate: string }[];
};

/** Quantas parcelas a prévia lista antes de resumir o resto numa linha. */
const SHOWN = 4;

/**
 * A prévia da nova cobrança ou despesa no desenho da prévia do cadastro de cliente (2026-10-27, a pedido: "deixe
 * semelhante ao que temos no cadastro do cliente"): a capa no véu do matiz com a foto de quem paga (ou o glifo do
 * recibo, na avulsa), o bloco de quem é com as etiquetas, o título e o valor, as parcelas e o pagamento em linhas
 * de rótulo e valor, e, no pé, a linha como ela aparece na lista.
 */
export function ChargePreview({ draft }: { draft: ChargePreviewDraft }) {
  const outgoing = draft.direction === "outgoing";
  const method = chargeMethods[draft.method];
  const many = draft.installments.length > 1;
  const rest = draft.installments.length - SHOWN;
  const hue = draft.category?.hue ?? (outgoing ? "orange" : "blue");

  return (
    <>
      <div className={formWindow.cover} style={{ "--cover-hue": `var(--sys-${hue})` } as CSSProperties}>
        {draft.avatar ? (
          <Avatar name={draft.avatar.name} src={draft.avatar.url ?? undefined} size="xl" />
        ) : (
          <span className={styles.glyph} aria-hidden="true">
            <ReceiptIcon weight="duotone" />
          </span>
        )}
      </div>

      <section className={formWindow.block} aria-label={outgoing ? "A despesa" : "A cobrança"}>
        <span className={formWindow.sheetBadges}>
          <Badge tone={outgoing ? "orange" : "blue"} size="sm">
            {outgoing ? "Despesa" : "Cobrança"}
          </Badge>
          <Badge tone={many ? "warning" : "success"} size="sm">
            {many ? `${draft.installments.length} parcelas` : "À vista"}
          </Badge>
          {draft.recurrence !== "none" && (
            <Badge tone="purple" size="sm" icon={<ArrowsClockwiseIcon />}>
              {recurrenceLabels[draft.recurrence]}
            </Badge>
          )}
        </span>
        <div className={formWindow.sheetNaming}>
          <Text as="h3" variant="headline" weight="semibold" className={formWindow.sheetName}>
            {draft.title}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {draft.party}
          </Text>
        </div>
        <div className={formWindow.amountRow}>
          <span className={formWindow.amount}>
            <Text as="strong" variant="title3" weight="bold" numeric>
              {formatMoney(draft.amount)}
            </Text>
            <Text as="span" variant="caption1" tone="tertiary">
              {many ? `${draft.installments.length}x de ${formatMoney(draft.installments[0]?.amount ?? 0)}` : outgoing ? "Total a pagar" : "Total a receber"}
            </Text>
          </span>
        </div>
      </section>

      <FormWindowBlock title={many ? "Parcelas" : "Vencimento"}>
        <FormWindowRows
          rows={[
            ...draft.installments.slice(0, SHOWN).map((installment) => ({
              label: many ? `Parcela ${installment.number}, ${dateBr(installment.dueDate)}` : dateBr(installment.dueDate),
              icon: CalendarBlankIcon,
              value: draft.amount > 0 ? formatMoney(installment.amount) : "Sem valor",
            })),
            ...(rest > 0 ? [{ label: `e mais ${rest}`, value: "mês a mês" }] : []),
          ]}
        />
      </FormWindowBlock>

      <FormWindowBlock title="Pagamento">
        <FormWindowRows
          rows={[
            { label: "Forma", icon: method.icon, value: method.label },
            { label: outgoing ? "Sai de" : "Cai em", icon: BankIcon, value: draft.account },
            { label: "Categoria", icon: TagIcon, value: draft.category?.name ?? "Sem categoria" },
          ]}
        />
      </FormWindowBlock>

      {/* A linha que a cobrança vira na lista, como a do contato na escolha do cliente. */}
      <FormWindowBlock title={outgoing ? "Nas despesas" : "Nas cobranças"}>
        <div className={formWindow.previewLine}>
          {draft.avatar ? <Avatar name={draft.avatar.name} src={draft.avatar.url ?? undefined} size="xs" /> : <ReceiptIcon className={styles.lineGlyph} aria-hidden="true" />}
          <span className={formWindow.previewLineName}>
            <Text as="span" variant="footnote" weight="medium" truncate>
              {draft.title}
            </Text>
            <Text as="span" variant="caption2" tone="tertiary" truncate>
              {draft.party}
            </Text>
          </span>
          <Text as="span" variant="footnote" weight="semibold" numeric>
            {formatMoney(draft.amount)}
          </Text>
        </div>
      </FormWindowBlock>
    </>
  );
}
