/**
 * O perfil de quem entra, para o aplicativo: a conta (nome, e-mail, foto e capa) e o currículo. Mesma regra
 * da web, pelo mesmo `service.ts` de `features/settings`; aqui só muda a casca, que autentica por Bearer.
 */
import { saveProfileSchema } from "@/features/settings/schemas";
import { getAccount, getResume, saveAccount, saveResume } from "@/features/settings/service";
import { authorizeRequest, invalidPayload, readJson } from "@/lib/api/v1";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, "profile-read");
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth.session;
  const [account, resume] = await Promise.all([getAccount(supabase, userId), getResume(supabase, userId)]);
  if (!account) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

  return Response.json({ account, resume });
}

/** Salva a conta, o currículo, ou os dois de uma vez; um erro de um lado não desfaz o outro. */
export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, "profile-save");
  if ("response" in auth) return auth.response;

  const parsed = saveProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidPayload();

  const { supabase, userId } = auth.session;

  const account = parsed.data.account ? await saveAccount(supabase, userId, parsed.data.account) : null;
  if (account && !account.ok) return Response.json({ error: account.error, field: "account" }, { status: 400 });

  const resume = parsed.data.resume ? await saveResume(supabase, userId, parsed.data.resume) : null;
  if (resume && !resume.ok) return Response.json({ error: resume.error, field: "resume" }, { status: 400 });

  return Response.json({ account: account?.data ?? null, resume: resume?.data ?? null });
}
