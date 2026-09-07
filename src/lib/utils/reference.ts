/** Prefixo de três letras por domínio, o que a pessoa lê antes do número. */
export const referencePrefixes = {
  quote: "ORC",
  contract: "CTR",
  invoice: "COB",
  project: "PRJ",
  transaction: "TRX",
  task: "TAR",
  client: "CLI",
} as const;

export type ReferenceKind = keyof typeof referencePrefixes;

/**
 * Identificador curto que a pessoa vê, fala e procura, o mesmo em toda a aplicação: prefixo do domínio,
 * ano e sequência de quatro dígitos, como `ORC-2026-0042`. A sequência reinicia a cada ano e cresce além
 * de quatro dígitos se precisar; o id interno continua sendo o do banco.
 */
export function formatReference(kind: ReferenceKind, year: number, sequence: number) {
  return `${referencePrefixes[kind]}-${year}-${String(sequence).padStart(4, "0")}`;
}
