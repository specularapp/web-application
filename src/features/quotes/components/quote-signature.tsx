import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { DEFAULT_SIGNATURE_STYLE, signatureStamp } from "../signature";
import type { QuotePerson } from "../summary";
import styles from "./quote-signature.module.css";

export type QuoteSignatureProps = {
  /** Quem assina: o nome que vai desenhado e a foto do estilo digital. */
  owner: QuotePerson;
  /** Quando o documento foi assinado, em `yyyy-MM-dd`; sem data, nada de registro. */
  signedAt: string | null;
  /** O endereço que emitiu, escrito no registro do estilo digital. */
  host: string;
};

// A assinatura que fecha o documento, nos dois estilos que a casa tem (2026-09-10, a pedido). Ela é peça
// estática, em CSS Module e sem `use client`, como o resto do documento: o servidor a desenha junto da folha.
//
// **Escrita** é o nome de quem assina desenhado à mão, na Sacramento, com o registro ao lado: quem recebe vê
// uma assinatura, e a linha do lado diz que ela é digital e quando foi feita. **Digital** não tem letra
// nenhuma: a foto da pessoa em círculo grande e, ao lado, o registro com o nome em caixa alta, a data e por
// onde o documento saiu. Uma é a assinatura de próprio punho traduzida para a tela, a outra é o carimbo de
// quem assinou, e as duas dizem a mesma coisa de jeitos diferentes.
//
// O estilo é preferência de quem assina, então vem na pessoa; a tela que a escolhe entra depois, e por
// enquanto o padrão é a escrita.
export function QuoteSignature({ owner, signedAt, host }: QuoteSignatureProps) {
  const style = owner.signatureStyle ?? DEFAULT_SIGNATURE_STYLE;
  const registry = signedAt ? signatureStamp(signedAt) : null;

  if (style === "digital") {
    return (
      <section className={styles.signature} data-style="digital" aria-label={`Assinado digitalmente por ${owner.name}`}>
        {/* A foto vai em círculo, e não no squircle do resto da casa: aqui ela é o selo de quem assinou, na
            forma de um carimbo, e não o avatar da pessoa numa lista. */}
        <Avatar name={owner.name} src={owner.avatarUrl ?? undefined} size="lg" className={styles.seal} />
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
          <Text as="p" variant="subheadline" tone="secondary">
            Emitido pelo {host}
          </Text>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.signature} data-style="written" aria-label={`Assinado por ${owner.name}`}>
      {/* O nome desenhado é decorativo para a voz: quem lê a tela já ouviu o nome no rótulo da seção, e
          repeti-lo em letra cursiva não acrescenta nada. */}
      <p className={styles.written} aria-hidden="true">
        {owner.name}
      </p>
      <div className={styles.registry}>
        <Text as="p" variant="footnote" tone="secondary">
          Documento assinado digitalmente
        </Text>
        {registry && (
          <Text as="p" variant="footnote" tone="secondary">
            Data: {registry}
          </Text>
        )}
      </div>
    </section>
  );
}
