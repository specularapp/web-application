/**
 * O teto de tempo de toda chamada ao servidor feita da tela.
 *
 * Existe porque uma Server Action que não volta deixa o botão girando para sempre: o `setSaving(null)` vem
 * depois do `await`, e sem resposta ele nunca roda. Foi o que o usuário viu em "salvar como rascunho"
 * (2026-09-16), onde a escrita ficava presa derrubando o cache. A causa daquele caso foi corrigida no
 * Redis, mas a lição vale para qualquer coisa entre a tela e o banco: rede, função fria, borda lenta. Quem
 * está esperando precisa receber uma resposta, nem que seja a de que demorou.
 *
 * Nunca rejeita: a falha volta no mesmo formato de toda action da casa, então quem chama já sabe tratar.
 */

/** Quinze segundos. Escrita lenta acontece; escrita que passa disso não vai voltar. */
export const ACTION_TIMEOUT = 15_000;

/**
 * A falha que este teto devolve. O `field` entra como indefinido de propósito: quase toda action da casa
 * devolve `field` na falha, e sem ele aqui o tipo da união perderia a propriedade e os formulários que a
 * leem parariam de compilar.
 */
export type ActionFailure = { ok: false; error: string; field?: undefined };

const TIMED_OUT = "A resposta demorou demais. Confira se deu certo antes de tentar de novo.";
const FAILED = "Não foi possível falar com o servidor. Tente de novo em instantes.";

/**
 * Chama uma action com teto de tempo. Devolve o que ela devolveu, ou uma falha com recado.
 *
 * O recado do estouro fala em conferir, e não em repetir: o servidor pode ter concluído a escrita depois de
 * a tela desistir de esperar, e mandar repetir cegamente é como se criam dois do mesmo registro.
 */
export async function callAction<T extends { ok: boolean }>(run: Promise<T>, timeout = ACTION_TIMEOUT): Promise<T | ActionFailure> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const ceiling = new Promise<ActionFailure>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: TIMED_OUT }), timeout);
  });

  try {
    return await Promise.race([run, ceiling]);
  } catch {
    /* Action que estoura vira falha em vez de rejeição solta: rejeição não tratada também deixa o botão
       girando, porque a linha que desliga o "salvando" fica depois do `await`. */
    return { ok: false, error: FAILED };
  } finally {
    clearTimeout(timer);
  }
}
