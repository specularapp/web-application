import "server-only";

/**
 * A mensagem de um erro do banco como ela pode aparecer na tela (2026-09-22, na varredura).
 *
 * Os serviços devolviam `error.message || FALLBACK`, e isso funcionava para o caso que importava: as funções
 * do banco da casa levantam exceção com texto em português, e esse texto é a mensagem certa para quem está
 * olhando. O problema é o resto. Quando o erro vem do driver, e não de uma função nossa, o que chega na tela
 * é o texto do Postgres: `new row for relation "clients" violates check constraint "clients_website_check"`,
 * ou `invalid input syntax for type uuid`. Isso não diz nada a quem usa, e conta o nome da tabela, da coluna
 * e da restrição a quem não precisa saber.
 *
 * A regra aqui é simples: o que a casa escreveu passa, o que o driver escreveu não. `P0001` é o código de
 * `raise exception` em plpgsql, que é exatamente o caminho das nossas funções. Os códigos de violação de
 * restrição ganham uma frase da casa, e qualquer outro cai no texto que o serviço já tinha como reserva.
 *
 * Um `if (error.code === ...)` antes da chamada continua valendo: o domínio sabe melhor que isto o que uma
 * chave estrangeira significa na tela dele, e esta função é só o chão.
 */

/** O que uma resposta de erro do Supabase traz e esta função lê. */
export type DbError = { code?: string; message?: string };

const byCode: Record<string, string> = {
  /* Violação de restrição de verificação: o valor passou pelo zod e não passou pela coluna. */
  "23514": "Algum campo está fora do formato que o sistema aceita. Confira os dados e tente de novo.",
  /* Unicidade: o domínio quase sempre traduz antes, dizendo qual campo repetiu. */
  "23505": "Já existe um registro com esse valor.",
  /* Não nulo. */
  "23502": "Falta preencher um campo obrigatório.",
  /* Texto ou número em formato inválido, como um id que não é uuid. */
  "22P02": "Algum valor chegou num formato inesperado.",
  "22001": "Algum texto passou do tamanho permitido.",
  /* Sem permissão: a RLS recusou. */
  "42501": "Você não tem permissão para isso nesta equipe.",
  /* Tempo esgotado e indisponibilidade breve. */
  "57014": "A operação demorou demais e foi cancelada. Tente de novo.",
};

export function dbMessage(error: DbError | null | undefined, fallback: string) {
  if (!error) return fallback;

  /* O texto das funções do banco é escrito pela casa, em português, e é a melhor mensagem que existe. */
  if (error.code === "P0001") return error.message || fallback;

  if (error.code && byCode[error.code]) return byCode[error.code];

  return fallback;
}
