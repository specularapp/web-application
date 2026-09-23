/**
 * O dia de hoje no fuso da casa (2026-09-22, na varredura do financeiro).
 *
 * O banco já decidia certo: `change_charge_payment` calcula a data de pagamento com
 * `(now() at time zone 'America/Sao_Paulo')::date`. O código em TypeScript não: `new Date().toISOString()`
 * devolve a data em UTC, e das 21h à meia-noite de Brasília o UTC já virou o dia seguinte. Nessas três horas
 * uma parcela que vence hoje era marcada como vencida, o cartão da cobrança mostrava "em atraso" enquanto o
 * rodapé do mesmo cartão dizia "vence hoje", e o servidor e o navegador desenhavam textos diferentes, o que
 * também fazia a hidratação divergir.
 *
 * A saída é ter um dia só, no fuso onde a equipe trabalha, e usá-lo nas duas pontas. Sem dependência nova:
 * `Intl` já sabe converter, e o `en-CA` é o idioma cujo formato curto é exatamente `YYYY-MM-DD`.
 */

/** O fuso em que a equipe trabalha, o mesmo que as funções do banco usam. */
export const HOUSE_TIME_ZONE = "America/Sao_Paulo";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOUSE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A data de um instante no fuso da casa, como `2026-09-22`. */
export function houseDay(at: Date = new Date()) {
  return isoFormatter.format(at);
}

/** A data de hoje no fuso da casa, com um deslocamento em dias. */
export function houseDayWithOffset(offset: number) {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + offset);
  return houseDay(at);
}
