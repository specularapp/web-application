/**
 * Texto virado endereço: sem acento, minúsculo, com hífen no lugar do que não é letra ou número, e sem
 * hífen sobrando nas pontas. Usado no endereço do time e na busca por nome, que compara os dois lados
 * pelo mesmo formato para acento e maiúscula não atrapalharem.
 *
 * Mora em `lib/utils`, e não junto dos esquemas do domínio (varredura de peso de 2026-09-08): a busca do
 * menu e a troca de time são componentes de cliente e só queriam esta função, mas ao importá-la de
 * `features/organizations/schemas.ts` levavam o zod inteiro para o navegador junto.
 */
export function slugify(value: string, limit = 40) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limit)
    .replace(/-+$/g, "");
}
