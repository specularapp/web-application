import type { CSSProperties, ReactNode } from "react";
import { Text } from "@/components/ui/text";
import { signatureStamp } from "@/features/quotes/signature";
import { cx } from "@/lib/utils/cx";
import type { Contract, ContractParty, DocNode } from "./summary";
import styles from "./document.module.css";

/**
 * O documento do contrato desenhado na tela, a partir dos nós que o editor grava: a mesma folha na prévia do
 * editor, na janela do contrato e na página pública, e o par do desenho em PDF de `pdf.tsx`. Peça estática,
 * em CSS Module e sem `use client`, para o servidor a desenhar junto da página pública.
 *
 * O bloco de assinaturas é do sistema, e não do texto: nasce das partes e do registro de cada assinatura, e
 * por isso ninguém o edita.
 */

export const partyRoles = { issuer: "Contratada", client: "Contratante" } as const;

/** Só endereços que abrem numa aba: o resto vira texto, porque o documento é do cliente e não do link. */
const safeHref = (value: unknown) => (typeof value === "string" && /^https?:\/\//i.test(value) ? value : null);

const alignOf = (node: DocNode): CSSProperties | undefined => {
  const align = node.attrs?.textAlign;
  return typeof align === "string" ? { textAlign: align as CSSProperties["textAlign"] } : undefined;
};

function renderText(node: DocNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong key={`${key}-b`}>{out}</strong>;
    else if (mark.type === "italic") out = <em key={`${key}-i`}>{out}</em>;
    else if (mark.type === "underline") out = <u key={`${key}-u`}>{out}</u>;
    else if (mark.type === "strike") out = <s key={`${key}-s`}>{out}</s>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      out = href ? (
        <a key={`${key}-a`} href={href} target="_blank" rel="noreferrer">
          {out}
        </a>
      ) : (
        out
      );
    }
  }
  return <span key={key}>{out}</span>;
}

function renderChildren(node: DocNode) {
  return node.content?.map((child, index) => renderNode(child, index)) ?? null;
}

export function renderNode(node: DocNode, key = 0): ReactNode {
  switch (node.type) {
    case "doc":
      return <div key={key}>{renderChildren(node)}</div>;
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (level <= 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      return (
        <Tag key={key} style={alignOf(node)}>
          {renderChildren(node)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} style={alignOf(node)}>
          {node.content?.length ? renderChildren(node) : <br />}
        </p>
      );
    case "text":
      return renderText(node, key);
    case "bulletList":
      return <ul key={key}>{renderChildren(node)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderChildren(node)}</ol>;
    case "listItem":
      return <li key={key}>{renderChildren(node)}</li>;
    case "blockquote":
      return <blockquote key={key}>{renderChildren(node)}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    default:
      return null;
  }
}

export type ContractSignaturesProps = { parties: ContractParty[]; className?: string };

/**
 * O bloco de assinaturas que fecha o documento: uma coluna por parte, com o papel, o nome e o e-mail, o traço
 * desenhado por quem já assinou sobre a linha e o registro com data e hora, ou "Aguardando assinatura". É a
 * mesma peça na folha da tela e, em `pdf.tsx`, no arquivo.
 */
export function ContractSignatures({ parties, className }: ContractSignaturesProps) {
  return (
    <section className={cx(styles.signatures, className)} aria-label="Assinaturas">
      {parties.map((party) => (
        <div key={party.id} className={styles.signer}>
          <div className={styles.stroke}>
            {party.signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={party.signatureUrl} alt={`Assinatura de ${party.name}`} className={styles.trace} />
            )}
          </div>
          <span className={styles.line} aria-hidden="true" />
          <Text as="p" variant="footnote" weight="semibold" className={styles.signerName}>
            {party.name}
          </Text>
          <Text as="p" variant="caption2" tone="secondary">
            {partyRoles[party.role]}, {party.email}
          </Text>
          <Text as="p" variant="caption2" tone={party.signedAt ? "secondary" : "tertiary"}>
            {party.signedAt ? `Assinado digitalmente em ${signatureStamp(party.signedAt)}` : "Aguardando assinatura"}
          </Text>
        </div>
      ))}
    </section>
  );
}

export type ContractDocumentProps = {
  contract: Contract;
  /** `preview` é a folha dentro do editor, sem a moldura própria; `page` é a folha inteira na página pública e na janela. */
  variant?: "page" | "preview";
  /** O documento no lugar do gravado: é o que o editor passa enquanto a pessoa digita. */
  body?: DocNode | null;
  className?: string;
};

// A folha do contrato escrito: o texto do documento, que já abre pelo título na forma da norma (o cabeçalho
// com quem emite saiu a pedido em 2026-09-14, porque não é da norma), e o bloco de assinaturas no pé. Papel é branco em qualquer tema, como no
// orçamento: o `data-scheme="light"` é a ilha de tema claro dos tokens.
export function ContractDocument({ contract, variant = "page", body, className }: ContractDocumentProps) {
  const content = body === undefined ? contract.body : body;

  return (
    <article className={cx(styles.sheet, className)} data-variant={variant} data-theme={contract.theme} data-scheme="light" aria-label={`Contrato ${contract.reference}`}>
      <div className={styles.body}>{content ? renderNode(content) : null}</div>

      <ContractSignatures parties={contract.parties} className={styles.foot} />
    </article>
  );
}
