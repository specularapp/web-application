/*
 * O cargo só de tarefas (2026-10-28, a pedido: "crie um cargo no sistema que terá acesso apenas a tarefas"): onde
 * ele pode estar. Puro, sem servidor, porque o menu e a busca filtram pela mesma lista que o servidor usa para
 * devolver a pessoa às tarefas. A RLS já não entrega nada de fora delas; isto é para ninguém cair numa tela vazia.
 */

export const TASKS_ROLE = "tasks";

export const TASKS_HOME = "/tarefas";

const PREFIXES = ["/tarefas", "/convite"];
const EXACT = ["/configuracoes", "/configuracoes/seguranca", "/configuracoes/notificacoes"];

export function tasksRoleAllows(pathname: string) {
  return EXACT.includes(pathname) || PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
