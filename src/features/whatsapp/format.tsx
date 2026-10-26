import { Fragment, type ReactNode } from "react";

/*
 * A formatação do WhatsApp na tela, com as regras do aplicativo: *negrito*, _itálico_, ~tachado~, ```monoespaçado``` e
 * `código`. O marcador fica colado ao texto, fora do meio de uma palavra e numa linha só; o que não fecha fica como foi
 * escrito.
 */

type Rule = { pattern: RegExp; wrap: (children: ReactNode, key: string) => ReactNode; raw?: boolean };

const RULES: Rule[] = [
  { pattern: /```([^\n]+?)```/u, wrap: (children, key) => <code key={key}>{children}</code>, raw: true },
  { pattern: /`([^`\n]+)`/u, wrap: (children, key) => <code key={key}>{children}</code>, raw: true },
  { pattern: /(?<![\p{L}\p{N}*])\*(?=\S)([^\n*]*?\S)\*(?![\p{L}\p{N}*])/u, wrap: (children, key) => <strong key={key}>{children}</strong> },
  { pattern: /(?<![\p{L}\p{N}_])_(?=\S)([^\n_]*?\S)_(?![\p{L}\p{N}_])/u, wrap: (children, key) => <em key={key}>{children}</em> },
  { pattern: /(?<![\p{L}\p{N}~])~(?=\S)([^\n~]*?\S)~(?![\p{L}\p{N}~])/u, wrap: (children, key) => <s key={key}>{children}</s> },
];

/** O trecho com a formatação aplicada: o primeiro marcador que aparece ganha, e o miolo dele também é lido. */
export function whatsappFormat(text: string, key = "w"): ReactNode[] {
  let first: { index: number; length: number; inner: string; rule: Rule } | null = null;
  for (const rule of RULES) {
    const found = rule.pattern.exec(text);
    if (found && (!first || found.index < first.index)) first = { index: found.index, length: found[0].length, inner: found[1], rule };
  }
  if (!first) return text ? [text] : [];
  const before = text.slice(0, first.index);
  const after = text.slice(first.index + first.length);
  const inner = first.rule.raw ? first.inner : whatsappFormat(first.inner, `${key}i`);
  return [...(before ? [before] : []), first.rule.wrap(inner, `${key}-${first.index}`), ...whatsappFormat(after, `${key}a`)];
}

export function WhatsappText({ text }: { text: string }) {
  return <Fragment>{whatsappFormat(text)}</Fragment>;
}

/** O texto sem os marcadores, para as linhas de uma linha só, como a prévia da lista. */
export function whatsappPlain(text: string): string {
  let out = text;
  for (let pass = 0; pass < 4; pass++) {
    const before = out;
    for (const rule of RULES) out = out.replace(new RegExp(rule.pattern.source, "gu"), "$1");
    if (out === before) break;
  }
  return out;
}
