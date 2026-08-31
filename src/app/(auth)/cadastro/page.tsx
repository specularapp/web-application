import { SignUpForm } from "@/features/auth/components/signup-form";
import { env, hasTurnstile } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import { safePath } from "@/lib/security/safe-path";

export const metadata = createMetadata({
  title: "Criar conta",
  description: "Crie sua conta Specular e comece a organizar seus projetos",
  path: "/cadastro",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const params = await searchParams;
  const next = safePath(first(params.next));
  const turnstileSiteKey = hasTurnstile() ? env.turnstilePublic().NEXT_PUBLIC_TURNSTILE_SITE_KEY : undefined;

  return <SignUpForm next={next} turnstileSiteKey={turnstileSiteKey} />;
}
