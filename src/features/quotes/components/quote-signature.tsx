import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { signatureStamp } from "../signature";
import type { QuotePerson } from "../summary";
import styles from "./quote-signature.module.css";

export type QuoteSignatureProps = {
  /** Quem assina: o rosto e o nome que vão no registro. */
  owner: QuotePerson;
  /** Quando o documento foi assinado, em `yyyy-MM-dd`; sem data, nada de registro. */
  signedAt: string | null;
  /** O endereço que emitiu, escrito na última linha. */
  host: string;
};

// A assinatura que fecha o documento (2026-09-10, a pedido): a linha de assinar e, embaixo dela, o rosto de
// quem vendeu em círculo com o registro do documento assinado ao lado. Peça estática, em CSS Module e sem
// `use client`, como o resto do documento: o servidor a desenha junto da folha.
//
// **É só o registro digital**: uma versão com o nome escrito à mão, na Sacramento, durou uma rodada e saiu no
// mesmo dia, a pedido. Sem a letra cursiva a assinatura lê como registro, que é o que ela é, e a casa fica
// com uma família tipográfica só.
//
// A escala é enxuta de propósito (pedido de 2026-09-10): a peça é o rodapé do documento, e não um bloco de
// destaque, então cada texto fica um degrau abaixo do corpo e o selo tem a altura do bloco ao lado, sem
// medida escrita à mão. Sem foto entra o rosto desenhado do `Avatar`, como em todo lugar da casa.
export function QuoteSignature({ owner, signedAt, host }: QuoteSignatureProps) {
  const registry = signedAt ? signatureStamp(signedAt) : null;

  return (
    <section className={styles.signature} aria-label={`Assinado digitalmente por ${owner.name}`}>
      <span className={styles.rule} aria-hidden="true" />

      <div className={styles.credit}>
        {/* O selo vai em círculo, e não no squircle do resto da casa: ele é o carimbo de quem assinou, e não
            o avatar da pessoa numa lista. */}
        <Avatar name={owner.name} src={owner.avatarUrl ?? undefined} size="sm" className={styles.seal} />

        <div className={styles.registry}>
          <Text as="p" variant="caption2" tone="secondary">
            Documento assinado digitalmente
          </Text>
          {/* O nome em caixa alta, que é como um registro escreve quem assinou. */}
          <Text as="p" variant="footnote" weight="semibold" className={styles.name}>
            {owner.name}
          </Text>
          {registry && (
            <Text as="p" variant="caption2" tone="secondary">
              Data: {registry}
            </Text>
          )}
          <Text as="p" variant="caption2" tone="tertiary" className={styles.host}>
            Emitido pelo {host}
          </Text>
        </div>
      </div>
    </section>
  );
}
