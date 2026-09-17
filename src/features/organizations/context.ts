import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser, requireUser, type SessionUser } from "@/features/auth/session";
import { dropTags } from "@/lib/cache";
import { tagsToDrop, type DomainTag } from "@/lib/cache/tags";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { organizationOf } from "./service";

/**
 * O contexto que toda leitura e toda escrita de domínio precisa: o cliente do Supabase com a sessão da
 * pessoa, quem ela é e em qual organização ela está agora. Num lugar só porque a alternativa é cada
 * `queries.ts` repetir a mesma sequência de três chamadas e escolher sozinho o que fazer quando falta time.
 *
 * A RLS continua sendo quem decide: o id da organização daqui serve para filtrar e para preencher a coluna
 * na escrita, e não para liberar nada. Quem forjar outro id não passa da policy.
 */
export type OrganizationContext = {
  supabase: SupabaseClient<Database>;
  user: SessionUser;
  organizationId: string;
};

/* Memorizado por requisição: a página chama `requireOrganization` uma vez e cada `queries.ts` que ela usa
   chama de novo. Sem isto, abrir a tela de orçamentos resolvia o time quatro vezes, com a consulta ao
   perfil em cada uma. O `cache` do React vale só dentro da renderização, então nada atravessa pedidos. */
const resolve = cache(async function resolve(user: SessionUser) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const organizationId = await organizationOf(supabase, user.id, profile?.current_organization_id ?? null);
  return { supabase, organizationId };
});

/** O contexto quando há sessão e time; nulo em qualquer outro caso. Para quem sabe seguir sem os dois. */
export const getOrganizationContext = cache(async function getOrganizationContext(): Promise<OrganizationContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { supabase, organizationId } = await resolve(user);
  if (!organizationId) return null;

  return { supabase, user, organizationId };
});

export const DASHBOARD_PATH = "/dashboard";

/**
 * O contexto ou a saída da página. Sem sessão vai para o login com o destino guardado; com sessão e sem
 * time vai para o painel, que é onde a configuração inicial aparece por cima.
 *
 * O painel é o destino de quem não tem time, então ele é o único lugar que não pode exigir um: mandá-lo
 * para si mesmo era o laço que travava a primeira entrada de quem acabava de se cadastrar, e o laço só
 * aparecia na conta nova, que é a que ninguém testa. Quem desenha o painel usa `getOrganizationContext` e
 * mostra o vazio; chamar daqui com o painel como destino é engano de código, e estourar é como ele
 * aparece na primeira vez em vez de virar carregamento eterno.
 */
export async function requireOrganization(next = DASHBOARD_PATH): Promise<OrganizationContext> {
  const user = await requireUser(next);
  const { supabase, organizationId } = await resolve(user);
  if (!organizationId) {
    if (next === DASHBOARD_PATH) throw new Error(`${NO_TEAM} (requireOrganization com destino ${DASHBOARD_PATH})`);
    redirect(DASHBOARD_PATH);
  }

  return { supabase, user, organizationId };
}

export const TOO_MANY = "Muitas ações em pouco tempo. Aguarde um instante e tente de novo.";
export const NO_TEAM = "Escolha ou crie um time antes de continuar.";
export const INVALID_INPUT = "Confira os dados informados.";

/**
 * A casca de toda Server Action de domínio: sessão, time em vigor e teto de requisições, na mesma ordem e
 * com as mesmas mensagens. Sem isto, cada action repetiria as três linhas e uma delas acabaria esquecendo o
 * teto, que é justamente a que seria descoberta em produção.
 */
export async function guardAction(
  operation: string,
): Promise<{ ok: true; context: OrganizationContext } | { ok: false; error: string }> {
  const context = await getOrganizationContext();
  if (!context) return { ok: false, error: NO_TEAM };

  const { checkRateLimit } = await import("@/lib/security/rate-limit");
  const { allowed } = await checkRateLimit("action", `${operation}:${context.user.id}`, crypto.randomUUID());
  if (!allowed) return { ok: false, error: TOO_MANY };

  return { ok: true, context };
}

/**
 * O que toda escrita faz depois de gravar: derruba o cache dos domínios que dependem do que mudou e manda o
 * Next refazer as rotas afetadas. Numa chamada só, porque esquecer uma das duas metades deixa a tela certa e
 * o cache velho, ou o contrário.
 */
export async function revalidateDomain(organizationId: string, changed: DomainTag[], paths: string[] = []) {
  await dropTags(organizationId, tagsToDrop(...changed));
  for (const path of paths) revalidatePath(path);
}

/** O primeiro problema que o zod achou, já no formato que o formulário usa para acender o campo. */
export function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return { error: issue?.message || INVALID_INPUT, field: field || undefined };
}

/** A mesma resolução para a API do aplicativo, que já tem cliente e sessão e só precisa do time. */
export async function organizationForApi(supabase: SupabaseClient<Database>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_organization_id")
    .eq("id", userId)
    .maybeSingle();

  return organizationOf(supabase, userId, profile?.current_organization_id ?? null);
}
