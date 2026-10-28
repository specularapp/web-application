import { formatMoney } from "@/lib/utils/format";

/*
 * As miudezas de dinheiro e data das telas de contas e transferências (2026-10-27): o valor com sinal, a data
 * curta e o par de chave e valor com que cada janela abre.
 */

/** "+R$ 120,00" e "−R$ 80,00", com o sinal de menos tipográfico. */
export const signedMoney = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatMoney(Math.abs(cents))}`;

/** "27/10/2026", a partir de `yyyy-MM-dd`, sem passar por fuso. */
export const dateBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** "27/10". */
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Uma janela aberta com uma chave nova, para o formulário de dentro nascer limpo a cada abertura. */
export type Opened<T> = { key: number; value: T } | null;

/** O dia `days` antes de `iso` (negativo vai para a frente), sem passar por fuso. */
export const dayBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
