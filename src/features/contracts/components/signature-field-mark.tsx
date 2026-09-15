import { Text } from "@/components/ui/text";
import { signatureStamp } from "@/features/quotes/signature";
import { cx } from "@/lib/utils/cx";
import { partyRoles } from "../document";
import type { ContractParty, SignatureField } from "../summary";
import styles from "./signature-field-mark.module.css";

export type SignatureFieldMarkProps = {
  field: SignatureField;
  party: ContractParty;
  /** O campo de quem está assinando agora: acende para dizer "é aqui". */
  highlighted?: boolean;
  className?: string;
};

/**
 * Um campo de assinatura desenhado sobre a página do PDF, em frações dela: vazio, com o papel e o nome de
 * quem assina, enquanto a parte não assinou; com o traço dela sobre a linha e o registro embaixo depois. É a
 * mesma peça na janela do contrato e na página pública, e o editor de campos a veste de arrastável.
 */
export function SignatureFieldMark({ field, party, highlighted = false, className }: SignatureFieldMarkProps) {
  const style = { left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%` };

  return (
    <div className={cx(styles.field, className)} style={style} data-signed={party.signedAt ? "" : undefined} data-highlighted={highlighted || undefined} aria-label={`Assinatura de ${party.name}`}>
      {party.signatureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={party.signatureUrl} alt="" className={styles.trace} />
      ) : (
        <Text as="span" variant="caption2" tone="secondary" className={styles.label} truncate>
          {partyRoles[party.role]}: {party.name}
        </Text>
      )}
      <span className={styles.line} aria-hidden="true" />
      <Text as="span" variant="caption2" tone={party.signedAt ? "secondary" : "tertiary"} className={styles.stamp} truncate>
        {party.signedAt ? `${party.name}, ${signatureStamp(party.signedAt)}` : "Assine aqui"}
      </Text>
    </div>
  );
}
