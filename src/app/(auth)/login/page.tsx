import { LoginForm } from "@/features/auth/components/login-form";
import { loginNotice } from "@/features/auth/messages";
import { env, hasTurnstile } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import { safePath } from "@/lib/security/safe-path";

export const metadata = createMetadata({
  title: "Entrar",
  description: "Acesse sua conta Specular",
  path: "/login",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safePath(first(params.next));
  const notice = loginNotice(first(params.erro));
  const turnstileSiteKey = hasTurnstile() ? env.turnstilePublic().NEXT_PUBLIC_TURNSTILE_SITE_KEY : undefined;

  return <LoginForm next={next} notice={notice} turnstileSiteKey={turnstileSiteKey} />;
}
