import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { recordKinds, type RecordKind, type RecordMedia } from "../records";
import styles from "./record-media.module.css";

export type RecordMediaProps = {
  kind: RecordKind;
  media?: RecordMedia;
  /** O nome de quem é, para o rosto gerado e para o leitor de tela. */
  name: string;
  /** `md` é a medida da linha de lista; `lg` é a da cabeça de um resumo. */
  size?: "md" | "lg";
  /** Quantos itens a arte representa, escrito ao lado dela. Fora do resumo, em que isso já é um fato. */
  total?: boolean;
  /**
   * Uma arte só, num azulejo, em vez da fila sobreposta: é o desenho da cabeça de um resumo, o mesmo do
   * catálogo e da base de clientes, em que a mídia é uma e o nome vem ao lado.
   */
  single?: boolean;
};

/**
 * Como um registro se apresenta, num lugar só (2026-09-10): quem tem rosto mostra o rosto, um orçamento
 * mostra as artes dos serviços na fila agrupada da casa, e o resto mostra o glifo do domínio no azulejo do
 * matiz dele. É a mesma peça no seletor de registros e na lista de vínculos da tarefa, porque a pergunta que
 * ela responde é a mesma: "que registro é este?".
 *
 * A fila de artes é a receita da coluna de orçamentos da casa: bolinhas redondas com o véu do matiz do item,
 * a arte com folga dentro, sobreposição apertada, anel na cor do fundo e o total ao lado. Redonda, e não
 * squircle, porque círculo não passa pelo sistema de cantos, pela regra da casa.
 */
export function RecordMediaView({ kind, media, name, size = "md", total = true, single = false }: RecordMediaProps) {
  if (media?.kind === "face") return <Avatar name={media.name} size={size === "lg" ? "md" : "sm"} shape={single ? "squircle" : undefined} />;

  if (media?.kind === "art" && single) {
    const first = media.items[0];
    return (
      <span
        className={styles.tile}
        data-size={size}
        data-art
        style={{ "--tile-hue": first?.hue ?? recordKinds[kind].hue } as CSSProperties}
        aria-hidden="true"
        {...squircle(size === "lg" ? "lg" : "md", { clip: true })}
      >
        {first ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.url} alt="" width={44} height={44} loading="lazy" decoding="async" />
        ) : null}
      </span>
    );
  }

  if (media?.kind === "art") {
    return (
      <span className={styles.arts} data-size={size}>
        <span className={styles.stack} aria-hidden="true">
          {media.items.map((item) => (
            <span key={item.url} className={styles.art} style={{ "--art-hue": item.hue } as CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" width={24} height={24} loading="lazy" decoding="async" />
            </span>
          ))}
        </span>
        {total && (
          <Text as="span" variant="footnote" weight="medium" tone="secondary">
            {media.total}
          </Text>
        )}
      </span>
    );
  }

  const meta = recordKinds[kind];
  const Glyph = meta.icon;

  return (
    <span className={styles.tile} data-size={size} style={{ "--tile-hue": meta.hue } as CSSProperties} aria-label={`${meta.label}: ${name}`} {...squircle(size === "lg" ? "lg" : "md", { clip: true })}>
      <Glyph weight="bold" aria-hidden="true" />
    </span>
  );
}
