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

// A assinatura que fecha o documento (2026-09-10, a pedido, no lugar da linha em branco para assinar à mão):
// a foto de quem vendeu em círculo e, ao lado, o registro do documento assinado. Peça estática, em CSS Module
// e sem `use client`, como o resto do documento: o servidor a desenha junto da folha.
//
// **É só digital**: uma versão com o nome escrito à mão, na Sacramento, durou uma rodada e saiu no mesmo dia,
// a pedido. Sem a letra cursiva a assinatura lê como registro, que é o que ela é, e o documento fica com uma
// família tipográfica só, como o resto da casa.
//
// Sem foto entra o rosto desenhado do `Avatar`, como em todo lugar da casa.
export function QuoteSignature({ owner, signedAt, host }: QuoteSignatureProps) {
  const registry = signedAt ? signatureStamp(signedAt) : null;

  return (
    <section className={styles.signature} aria-label={`Assinado digitalmente por ${owner.name}`}>
      {/* O selo vai em círculo, e não no squircle do resto da casa: ele é o carimbo de quem assinou, e não o
          avatar da pessoa numa lista. */}
      <Avatar name={owner.name} src={owner.avatarUrl ?? undefined} className={styles.seal} />

      <div className={styles.registry}>
        <Text as="p" variant="subheadline" tone="secondary">
          Documento assinado digitalmente
        </Text>
        {/* O nome em caixa alta, que é como um registro escreve quem assinou. */}
        <Text as="p" variant="title3" weight="semibold" className={styles.name}>
          {owner.name}
        </Text>
        {registry && (
          <Text as="p" variant="subheadline" tone="secondary">
            Data: {registry}
          </Text>
        )}
        {/* A emissora fica separada das três linhas de cima por um respiro: as primeiras dizem quem assinou,
            esta diz de onde o documento saiu. */}
        <Text as="p" variant="subheadline" tone="secondary" className={styles.host}>
          Emitido pelo {host}
        </Text>
      </div>
    </section>
  );
}
